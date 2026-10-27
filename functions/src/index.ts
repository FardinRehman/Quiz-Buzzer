import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.database();

/**
 * ATOMIC 2-TIER BUZZ CLAIM FUNCTION
 * Authoritative Firebase Realtime Database transaction that accepts Contestant #1 and Contestant #2
 * and immediately locks further buzzer attempts once 2 contestants have been accepted.
 */
export const submitBuzz = functions.https.onCall(async (data, context) => {
  // 1. Verify Authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Contestant must be authenticated with valid Firebase token.'
    );
  }

  const { sessionId, roundId } = data;
  if (!sessionId || !roundId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'sessionId and roundId are required.'
    );
  }

  const uid = context.auth.uid;

  // 2. Verify Student Role and Active Account Status
  const userSnapshot = await db.ref(`users/${uid}`).once('value');
  const userProfile = userSnapshot.val();

  if (!userProfile) {
    throw new functions.https.HttpsError(
      'not-found',
      'Student profile not registered in quiz directory.'
    );
  }

  if (userProfile.accountStatus === 'disabled') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Student account is currently disabled by administrator.'
    );
  }

  if (userProfile.role !== 'student') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only enrolled students may buzz in quiz rounds.'
    );
  }

  const roundRef = db.ref(`sessions/${sessionId}/rounds/${roundId}`);
  const now = Date.now();

  // Check if student already buzzed in attempts log
  const existingAttemptSnap = await roundRef.child(`attempts/${uid}`).once('value');
  if (existingAttemptSnap.exists()) {
    return {
      accepted: false,
      reason: 'ALREADY_BUZZED',
      latencyMs: 0,
    };
  }

  // 3. ATOMIC TRANSACTION on authoritative Round record
  let transactionResult: {
    committed: boolean;
    snapshot: admin.database.DataSnapshot | null;
  };

  try {
    transactionResult = await roundRef.transaction(currentRound => {
      if (!currentRound) return currentRound;

      const isAccepting =
        (currentRound.status === 'OPEN' ||
          currentRound.status === 'QUESTION_ACTIVE' ||
          currentRound.status === 'AWAITING_ANSWER_EVALUATION') &&
        (!currentRound.contestants || currentRound.contestants.length < 2);

      if (!isAccepting) return; // abort

      if (!currentRound.contestants) currentRound.contestants = [];

      // Check duplicate
      if (currentRound.contestants.some((c: { uid: string }) => c.uid === uid)) {
        return; // abort
      }

      const latencyMs = currentRound.roundOpenedAt ? Math.max(1, now - currentRound.roundOpenedAt) : 0;

      // Case 1: First contestant
      if (currentRound.contestants.length === 0) {
        currentRound.contestants.push({
          uid,
          studentId: userProfile.studentId || 'N/A',
          displayName: userProfile.displayName,
          position: 1,
          buzzedAt: now,
          latencyMs,
          evaluation: 'pending',
        });
        currentRound.activeContestantIndex = 0;
        currentRound.status = 'AWAITING_ANSWER_EVALUATION';
        currentRound.winnerUid = uid;
        currentRound.winnerStudentId = userProfile.studentId || 'N/A';
        currentRound.winnerNameSnapshot = userProfile.displayName;
        currentRound.winnerAcceptedAt = admin.database.ServerValue.TIMESTAMP;
        currentRound.winnerLatencyMs = latencyMs;
        return currentRound;
      }

      // Case 2: Second contestant
      if (currentRound.contestants.length === 1) {
        currentRound.contestants.push({
          uid,
          studentId: userProfile.studentId || 'N/A',
          displayName: userProfile.displayName,
          position: 2,
          buzzedAt: now,
          latencyMs,
          evaluation: 'pending',
        });
        currentRound.status = 'BUZZER_LOCKED';
        return currentRound;
      }

      return; // abort
    });
  } catch (err) {
    console.error('Buzzer transaction error:', err);
    throw new functions.https.HttpsError('internal', 'Transaction execution failed');
  }

  // 4. Evaluate Transaction Outcome
  if (transactionResult.committed) {
    const updatedRound = transactionResult.snapshot?.val();
    const contestants = updatedRound?.contestants || [];
    const myContestant = contestants.find((c: { uid: string }) => c.uid === uid);
    const position = myContestant?.position || 1;
    const latency = myContestant?.latencyMs || 0;

    await roundRef.child(`attempts/${uid}`).set({
      uid,
      studentId: userProfile.studentId,
      displayName: userProfile.displayName,
      submittedAt: admin.database.ServerValue.TIMESTAMP,
      status: position === 1 ? 'ACCEPTED_FIRST' : 'ACCEPTED_SECOND',
      latencyMs: latency,
      position,
    });

    return {
      accepted: true,
      position,
      reason: position === 1 ? 'FIRST_CONTESTANT' : 'SECOND_CONTESTANT',
      latencyMs: latency,
      contestants,
    };
  } else {
    // Aborted: Too late or closed
    const currentSnapshot = await roundRef.once('value');
    const roundData = currentSnapshot.val();
    const latencyMs = roundData?.roundOpenedAt ? now - roundData.roundOpenedAt : 0;

    await roundRef.child(`attempts/${uid}`).set({
      uid,
      studentId: userProfile.studentId,
      displayName: userProfile.displayName,
      submittedAt: admin.database.ServerValue.TIMESTAMP,
      status: roundData?.contestants?.length >= 2 ? 'REJECTED_TOO_LATE' : 'REJECTED_ROUND_CLOSED',
      latencyMs,
    });

    return {
      accepted: false,
      reason: roundData?.contestants?.length >= 2 ? 'TOO_LATE' : 'ROUND_NOT_OPEN',
      latencyMs,
      contestants: roundData?.contestants || [],
    };
  }
});

/**
 * ADMIN ANSWER EVALUATION & CRYPTO SCORING FUNCTION
 */
export const evaluateContestantAnswer = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Administrator authorization required.'
    );
  }

  const { sessionId, roundId, contestantIndex, result } = data;
  if (!sessionId || !roundId || (contestantIndex !== 0 && contestantIndex !== 1) || (result !== 'correct' && result !== 'wrong')) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid evaluation arguments.');
  }

  const roundRef = db.ref(`sessions/${sessionId}/rounds/${roundId}`);
  const roundSnap = await roundRef.once('value');
  const round = roundSnap.val();

  if (!round || !round.contestants || !round.contestants[contestantIndex]) {
    throw new functions.https.HttpsError('not-found', 'Contestant not found in round.');
  }

  const contestant = round.contestants[contestantIndex];
  if (contestant.evaluation && contestant.evaluation !== 'pending') {
    return { success: true, message: 'Already evaluated' };
  }

  const now = Date.now();
  const points = result === 'correct' ? (contestant.position === 1 ? 1000 : 700) : 0;

  contestant.evaluatedAt = now;
  contestant.evaluation = result;
  contestant.pointsAwarded = points;

  // Update student score summary
  const studentScoreRef = db.ref(`studentScores/${contestant.uid}`);
  await studentScoreRef.transaction(current => {
    const s = current || {
      uid: contestant.uid,
      displayName: contestant.displayName,
      studentId: contestant.studentId,
      totalCrypto: 0,
      correctAnswersCount: 0,
      firstBuzzerWins: 0,
      secondBuzzerWins: 0,
      lastAwardedAt: now,
    };
    if (result === 'correct') {
      s.totalCrypto += points;
      s.correctAnswersCount += 1;
      if (contestant.position === 1) {
        s.firstBuzzerWins += 1;
      } else {
        s.secondBuzzerWins += 1;
      }
      s.lastAwardedAt = now;
    }
    return s;
  });

  // Write audit ledger
  const ledgerKey = db.ref('scoreLedger').push().key;
  if (ledgerKey) {
    await db.ref(`scoreLedger/${ledgerKey}`).set({
      entryId: ledgerKey,
      sessionId,
      roundId,
      uid: contestant.uid,
      studentId: contestant.studentId,
      displayName: contestant.displayName,
      position: contestant.position,
      points,
      timestamp: now,
      reason: result === 'correct' ? `${contestant.position === 1 ? 'FIRST' : 'SECOND'}_CONTESTANT_CORRECT` : 'INCORRECT',
    });
  }

  // Update public leaderboard entry
  const updatedScoreSnap = await studentScoreRef.once('value');
  const updatedScore = updatedScoreSnap.val();
  await db.ref(`publicLeaderboard/${contestant.uid}`).set({
    uid: contestant.uid,
    displayName: contestant.displayName,
    studentId: contestant.studentId,
    totalCrypto: updatedScore.totalCrypto,
    correctAnswersCount: updatedScore.correctAnswersCount,
    firstBuzzerWins: updatedScore.firstBuzzerWins,
    secondBuzzerWins: updatedScore.secondBuzzerWins,
    lastAwardedAt: updatedScore.lastAwardedAt,
  });

  // State transitions
  if (contestant.position === 1) {
    if (result === 'correct') {
      round.status = 'ANSWER_CORRECT';
      round.roundClosedAt = now;
    } else {
      if (round.contestants.length >= 2) {
        round.status = 'NEXT_CONTESTANT';
        round.activeContestantIndex = 1;
      } else {
        round.status = 'QUESTION_COMPLETED';
        round.roundClosedAt = now;
      }
    }
  } else {
    round.status = result === 'correct' ? 'ANSWER_CORRECT' : 'ANSWER_INCORRECT';
    round.roundClosedAt = now;
  }

  await roundRef.set(round);
  return { success: true, pointsAwarded: points, round };
});

/**
 * ADMIN BOOTSTRAP FUNCTION
 * Sets protected custom claim { role: 'admin' } for the authorized admin.
 */
export const bootstrapAdmin = functions.https.onCall(async (data) => {
  const { secretKey, adminEmail, adminPassword, displayName } = data;

  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || 'quickbuzz_root_init_2026';
  if (secretKey !== expectedSecret) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Invalid bootstrap secret key.'
    );
  }

  const adminsQuery = await db.ref('users').orderByChild('role').equalTo('admin').once('value');
  if (adminsQuery.exists()) {
    throw new functions.https.HttpsError(
      'already-exists',
      'Authorized admin account already provisioned.'
    );
  }

  const userRecord = await admin.auth().createUser({
    email: adminEmail,
    password: adminPassword,
    displayName: displayName || 'Quizmaster Admin',
  });

  await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });

  await db.ref(`users/${userRecord.uid}`).set({
    uid: userRecord.uid,
    email: adminEmail,
    displayName: displayName || 'Quizmaster Admin',
    role: 'admin',
    accountStatus: 'active',
    createdAt: new Date().toISOString(),
  });

  return { success: true, uid: userRecord.uid };
});
