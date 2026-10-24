import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.database();

/**
 * ATOMIC BUZZ CLAIM FUNCTION
 * Uses authoritative Firebase Realtime Database transaction to guarantee
 * that exactly ONE student wins, even under simultaneous millisecond requests.
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

  // 3. ATOMIC TRANSACTION on authoritative Round record
  let transactionResult: {
    committed: boolean;
    snapshot: admin.database.DataSnapshot | null;
  };

  try {
    transactionResult = await roundRef.transaction(currentRound => {
      if (!currentRound) {
        return currentRound; // abort
      }

      // Must be OPEN
      if (currentRound.status !== 'OPEN') {
        return; // abort
      }

      // Check if winner already claimed
      if (currentRound.winnerUid) {
        return; // abort: another student already accepted
      }

      // ATOMically claim the win!
      const latencyMs = currentRound.roundOpenedAt ? Math.max(1, now - currentRound.roundOpenedAt) : 0;
      currentRound.winnerUid = uid;
      currentRound.winnerStudentId = userProfile.studentId || 'N/A';
      currentRound.winnerNameSnapshot = userProfile.displayName;
      currentRound.winnerAcceptedAt = admin.database.ServerValue.TIMESTAMP;
      currentRound.winnerLatencyMs = latencyMs;
      currentRound.status = 'WINNER_LOCKED';

      return currentRound;
    });
  } catch (err) {
    console.error('Buzzer transaction error:', err);
    throw new functions.https.HttpsError('internal', 'Transaction execution failed');
  }

  // 4. Evaluate Transaction Outcome
  if (transactionResult.committed) {
    const updatedRound = transactionResult.snapshot?.val();
    const winningLatency = updatedRound?.winnerLatencyMs || 0;

    // Record winning attempt
    await roundRef.child(`attempts/${uid}`).set({
      uid,
      studentId: userProfile.studentId,
      displayName: userProfile.displayName,
      submittedAt: admin.database.ServerValue.TIMESTAMP,
      status: 'ACCEPTED_WINNER',
      latencyMs: winningLatency,
    });

    return {
      accepted: true,
      reason: 'WINNER',
      latencyMs: winningLatency,
      winner: {
        name: userProfile.displayName,
        studentId: userProfile.studentId,
        latencyMs: winningLatency,
      },
    };
  } else {
    // Transaction aborted: Round closed or another student won first
    const currentSnapshot = await roundRef.once('value');
    const roundData = currentSnapshot.val();

    const latencyMs = roundData?.roundOpenedAt ? now - roundData.roundOpenedAt : 0;

    // Record rejected attempt in attempts log
    await roundRef.child(`attempts/${uid}`).set({
      uid,
      studentId: userProfile.studentId,
      displayName: userProfile.displayName,
      submittedAt: admin.database.ServerValue.TIMESTAMP,
      status: roundData?.status === 'OPEN' ? 'REJECTED_TOO_LATE' : 'REJECTED_ROUND_CLOSED',
      latencyMs,
    });

    return {
      accepted: false,
      reason: 'TOO_LATE',
      latencyMs,
      winner: {
        name: roundData?.winnerNameSnapshot || 'Another Contestant',
        studentId: roundData?.winnerStudentId || 'N/A',
        latencyMs: roundData?.winnerLatencyMs || null,
      },
    };
  }
});

/**
 * ADMIN BOOTSTRAP FUNCTION
 * Sets protected custom claim { role: 'admin' } for the authorized admin.
 */
export const bootstrapAdmin = functions.https.onCall(async (data, context) => {
  const { secretKey, adminEmail, adminPassword, displayName } = data;

  // Verify server-side secret key from environment
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || 'quickbuzz_root_init_2026';
  if (secretKey !== expectedSecret) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Invalid bootstrap secret key.'
    );
  }

  // Check if an admin already exists to enforce exactly one authorized admin
  const adminsQuery = await db.ref('users').orderByChild('role').equalTo('admin').once('value');
  if (adminsQuery.exists()) {
    throw new functions.https.HttpsError(
      'already-exists',
      'Authorized admin account already provisioned.'
    );
  }

  // Create Firebase Auth user
  const userRecord = await admin.auth().createUser({
    email: adminEmail,
    password: adminPassword,
    displayName: displayName || 'Quizmaster Admin',
  });

  // Assign custom claims { role: 'admin' }
  await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });

  // Store in database
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
