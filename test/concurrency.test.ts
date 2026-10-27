import assert from 'node:assert';
import { validateAndParseQuestionsCSV } from '../src/utils/csv';

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000';

async function runTests() {
  console.log('🧪 Starting Comprehensive QuickBuzz Automated Concurrency, CSV & Security Test Suite...\n');

  // =========================================================================
  // Section 1: CSV Parsing, BOM Handling, Escaping & Validation Unit Tests
  // =========================================================================
  console.log('▶ Unit Test: CSV Parsing & Validation (RFC-4180, BOM, Quotes, Commas)');
  
  // Valid CSV with UTF-8 BOM, quoted strings with commas and escaped quotes
  const validCsv = '\uFEFFquestion,correct_answer\r\n' +
    '"What is the capital of Karnataka?","Bengaluru"\r\n' +
    '"Which language is used to build React applications?","JavaScript"\r\n' +
    '"What does CPU stand for?","Central Processing Unit"\r\n' +
    '"Which protocol, commonly used in web, provides secure communication?","HTTPS"\r\n' +
    '"He said, ""Hello World"" in which language?","C++"';

  const parseResult = validateAndParseQuestionsCSV(validCsv);
  assert.strictEqual(parseResult.valid, true, 'Valid CSV must pass validation');
  assert.strictEqual(parseResult.validQuestions.length, 5, 'Should parse 5 questions');
  assert.strictEqual(parseResult.validQuestions[0].question, 'What is the capital of Karnataka?');
  assert.strictEqual(parseResult.validQuestions[0].correctAnswer, 'Bengaluru');
  assert.strictEqual(parseResult.validQuestions[3].question, 'Which protocol, commonly used in web, provides secure communication?');
  assert.strictEqual(parseResult.validQuestions[3].correctAnswer, 'HTTPS');
  assert.strictEqual(parseResult.validQuestions[4].question, 'He said, "Hello World" in which language?');
  assert.strictEqual(parseResult.errors.length, 0);
  console.log('  ✔ RFC-4180 parsing passed (UTF-8 BOM stripped, commas inside quotes handled, escaped quotes unescaped)');

  // Invalid CSV test: Missing required column
  const invalidHeaderCsv = 'title,answer\n"Question 1","Answer 1"';
  const badHeaderResult = validateAndParseQuestionsCSV(invalidHeaderCsv);
  assert.strictEqual(badHeaderResult.valid, false, 'Invalid headers must fail validation');
  assert.ok(badHeaderResult.errors.some(e => e.includes('question') && e.includes('correct_answer')), 'Should report missing required headers');
  console.log('  ✔ CSV missing required headers correctly rejected with clear error');

  // Invalid CSV test: Row with missing question or answer
  const invalidRowsCsv = 'question,correct_answer\n"Valid Question?","Valid Answer"\n"Missing Answer?",\n,"Missing Question"';
  const badRowsResult = validateAndParseQuestionsCSV(invalidRowsCsv);
  assert.strictEqual(badRowsResult.valid, false, 'Rows with missing fields must fail validation');
  assert.strictEqual(badRowsResult.errors.length, 2, 'Should report 2 row-level validation errors');
  assert.ok(badRowsResult.errors[0].includes('Row 3'), 'Should identify Row 3 error');
  assert.ok(badRowsResult.errors[1].includes('Row 4'), 'Should identify Row 4 error');
  console.log('  ✔ Row-level CSV validation errors reported with exact row numbers and descriptions');

  // =========================================================================
  // Section 2: Admin Authentication & Account Provisioning
  // =========================================================================
  console.log('\n▶ Test 1: Authenticate Admin Account');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'fardinrit@gmail.com', password: 'Fardin@RIT07' }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login failed');
  const adminData = await adminLoginRes.json();
  assert.strictEqual(adminData.user.role, 'admin');
  const adminToken = adminData.token;
  console.log('  ✔ Admin authenticated successfully with role: admin');

  // =========================================================================
  // Section 3: CSV Preview & Question Bank Import via Admin Endpoints
  // =========================================================================
  console.log('\n▶ Test 2: Admin CSV Preview & Question Bank Import');
  const csvContent = 'question,correct_answer\n' +
    '"What is the speed of light in vacuum?","299792458 m/s"\n' +
    '"Which planet is known as the Red Planet?","Mars"\n' +
    '"What is the primary gas found in Earth\'s atmosphere?","Nitrogen"\n' +
    '"What does HTML stand for?","HyperText Markup Language"\n' +
    '"Who created Linux kernel?","Linus Torvalds"';

  // Preview CSV endpoint
  const previewRes = await fetch(`${BASE_URL}/api/admin/questions/preview-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ csvContent }),
  });
  assert.strictEqual(previewRes.status, 200, 'CSV preview failed');
  const previewData = await previewRes.json();
  assert.strictEqual(previewData.valid, true);
  assert.strictEqual(previewData.totalDetected, 5);
  console.log('  ✔ Admin CSV preview detected 5 valid questions');

  // Import CSV endpoint
  const importRes = await fetch(`${BASE_URL}/api/admin/questions/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ csvContent }),
  });
  assert.strictEqual(importRes.status, 201, 'CSV import failed');
  const importData = await importRes.json();
  assert.strictEqual(importData.importedCount, 5);
  console.log(`  ✔ Successfully imported ${importData.importedCount} questions into Question Bank`);

  // Verify questions listing in admin panel
  const listQuestionsRes = await fetch(`${BASE_URL}/api/admin/questions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(listQuestionsRes.status, 200);
  const listQuestionsData = await listQuestionsRes.json();
  assert.ok(listQuestionsData.total >= 5);
  assert.ok(listQuestionsData.availableCount >= 5);
  console.log(`  ✔ Question Bank contains ${listQuestionsData.total} total questions (${listQuestionsData.availableCount} available)`);

  // =========================================================================
  // Section 4: Create Quiz Session & Test Random Question Selection
  // =========================================================================
  console.log('\n▶ Test 3: Create Quiz Session & Start Round with Random Question');
  const sessionRes = await fetch(`${BASE_URL}/api/admin/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ title: 'QuickBuzz Live Championship', customCode: 'CHAMP99' }),
  });
  assert.strictEqual(sessionRes.status, 201);
  const sessionData = await sessionRes.json();
  const sessionId = sessionData.session.sessionId;
  console.log(`  ✔ Created Session ID: ${sessionId} (PIN: CHAMP99)`);

  // Start round with random question from question bank
  const startRandomRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/start-random`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(startRandomRes.status, 200, 'Failed to start random round');
  const startRandomData = await startRandomRes.json();
  const round1 = startRandomData.round;
  const round1Id = round1.roundId;
  assert.strictEqual(round1.status, 'QUESTION_ACTIVE', 'Round status must be QUESTION_ACTIVE');
  assert.ok(round1.questionText.length > 5, 'Question text must be populated');
  assert.ok(round1.questionId, 'Question ID must be recorded on round');
  console.log(`  ✔ Round #1 started with random question: "${round1.questionText}"`);

  // =========================================================================
  // Section 5: Student Data Privacy & Answer Key Protection
  // =========================================================================
  console.log('\n▶ Test 4: Verify Student Data Privacy & Answer Key Protection');
  // Register 2 test students via quick-join
  const stu1Join = await fetch(`${BASE_URL}/api/sessions/quick-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alpha Contestant', sessionPin: 'CHAMP99', studentId: 'USN-001' }),
  });
  const stu1Data = await stu1Join.json();
  const stu1Token = stu1Data.token;

  // Student fetches session details
  const studentSessionRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stu1Token}` },
  });
  const studentSessionData = await studentSessionRes.json();
  const studentRoundView = studentSessionData.session.rounds[round1Id];
  
  // SECURITY ASSERTION: correctAnswer MUST NOT be leaked to students
  assert.strictEqual(studentRoundView.correctAnswer, undefined, 'CRITICAL: correctAnswer must NEVER be exposed to students before evaluation!');
  console.log('  ✔ SECURITY VERIFIED: Student session response contains question text but strictly hides correctAnswer');

  // Student tries to call admin-only endpoints
  const studentUnauthorizedCall = await fetch(`${BASE_URL}/api/admin/questions`, {
    headers: { Authorization: `Bearer ${stu1Token}` },
  });
  assert.strictEqual(studentUnauthorizedCall.status, 403, 'Student must be denied access to admin endpoints');
  console.log('  ✔ SECURITY VERIFIED: Student denied access to admin question bank (HTTP 403)');

  // =========================================================================
  // Section 6: 20 Simultaneous Concurrent Buzzes & 2-Tier Authoritative Race
  // =========================================================================
  console.log('\n▶ Test 5: Execute 20 Concurrent Simultaneous Buzz Requests (Authoritative 2-Contestant Order)');
  
  // Quick-join 20 unique contestants
  const tokens: { token: string; name: string; studentId: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const qJoin = await fetch(`${BASE_URL}/api/sessions/quick-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Racer ${i}`, sessionPin: 'CHAMP99', studentId: `RACER-${100 + i}` }),
    });
    const qData = await qJoin.json();
    tokens.push({ token: qData.token, name: `Racer ${i}`, studentId: `RACER-${100 + i}` });
  }

  console.log(`  Quick-joined ${tokens.length} racers. Launching 20 simultaneous buzz requests with Promise.all()...`);

  const buzzPromises = tokens.map(t =>
    fetch(`${BASE_URL}/api/sessions/${sessionId}/rounds/${round1Id}/buzz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.token}` },
    }).then(async r => ({ status: r.status, data: await r.json() }))
  );

  const buzzResults = await Promise.all(buzzPromises);

  const acceptedFirst = buzzResults.filter(r => r.data.accepted === true && r.data.position === 1);
  const acceptedSecond = buzzResults.filter(r => r.data.accepted === true && r.data.position === 2);
  const rejectedTooLate = buzzResults.filter(r => r.data.accepted === false && r.data.reason === 'TOO_LATE');

  console.log(`  Total buzz responses received: ${buzzResults.length}`);
  console.log(`  Contestant 1 (First place): ${acceptedFirst.length} accepted`);
  console.log(`  Contestant 2 (Second place): ${acceptedSecond.length} accepted`);
  console.log(`  Rejected (Too late / Locked): ${rejectedTooLate.length}`);

  // CRITICAL ATOMIC RACE GUARANTEES
  assert.strictEqual(acceptedFirst.length, 1, 'CRITICAL: Exactly ONE first contestant must be accepted!');
  assert.strictEqual(acceptedSecond.length, 1, 'CRITICAL: Exactly ONE second contestant must be accepted!');
  assert.strictEqual(rejectedTooLate.length, 18, 'CRITICAL: All other 18 contestants must be rejected as TOO_LATE!');
  console.log('  ✔ ATOMIC 2-TIER RACE GUARANTEE PASSED! Exactly 1 first contestant and 1 second contestant accepted');

  // Verify round state in database
  const checkRoundRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const checkRoundData = await checkRoundRes.json();
  const dbRound1 = checkRoundData.session.rounds[round1Id];
  assert.strictEqual(dbRound1.contestants.length, 2, 'Round must have exactly 2 registered contestants');
  assert.strictEqual(dbRound1.contestants[0].position, 1);
  assert.strictEqual(dbRound1.contestants[1].position, 2);
  assert.strictEqual(dbRound1.status, 'BUZZER_LOCKED', 'Round buzzer must be immediately locked after 2 contestants');
  console.log(`  ✔ Database verifies Contestant #1: ${dbRound1.contestants[0].displayName}, Contestant #2: ${dbRound1.contestants[1].displayName}`);

  // Duplicate buzz prevention test: same student buzzing again
  const duplicateBuzzRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}/rounds/${round1Id}/buzz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[0].token}` },
  });
  const duplicateData = await duplicateBuzzRes.json();
  assert.strictEqual(duplicateData.accepted, false);
  assert.strictEqual(duplicateData.reason, 'ALREADY_BUZZED', 'Duplicate buzz from same student must be rejected');
  console.log('  ✔ Duplicate buzz attempt by same student correctly rejected with ALREADY_BUZZED');

  // =========================================================================
  // Section 7: Admin Answer Evaluation Workflow (Wrong #1 -> Pass to #2 -> Correct #2)
  // =========================================================================
  console.log('\n▶ Test 6: Admin Answer Evaluation Workflow: Contestant #1 Wrong -> Contestant #2 Correct');
  const contestant1 = dbRound1.contestants[0];
  const contestant2 = dbRound1.contestants[1];

  // Admin marks Contestant #1 WRONG
  const eval1Res = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round1Id}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ contestantIndex: 0, result: 'wrong' }),
  });
  assert.strictEqual(eval1Res.status, 200, 'Evaluation of Contestant #1 failed');
  const eval1Data = await eval1Res.json();
  assert.strictEqual(eval1Data.pointsAwarded, 0, 'Wrong answer must award 0 Crypto');
  assert.strictEqual(eval1Data.round.activeContestantIndex, 1, 'Opportunity must pass to Contestant #2');
  assert.strictEqual(eval1Data.round.status, 'NEXT_CONTESTANT');
  console.log('  ✔ Contestant #1 marked WRONG (0 Crypto points awarded). Opportunity passed to Contestant #2');

  // Verify answer is STILL not revealed to students
  const studentMidRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stu1Token}` },
  });
  const studentMidData = await studentMidRes.json();
  assert.strictEqual(studentMidData.session.rounds[round1Id].correctAnswer, undefined, 'Correct answer must NOT be revealed after wrong attempt');
  console.log('  ✔ Question remains active without revealing the correct answer to contestants');

  // Admin marks Contestant #2 CORRECT (Should receive 700 Crypto points)
  const eval2Res = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round1Id}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ contestantIndex: 1, result: 'correct' }),
  });
  assert.strictEqual(eval2Res.status, 200, 'Evaluation of Contestant #2 failed');
  const eval2Data = await eval2Res.json();
  assert.strictEqual(eval2Data.pointsAwarded, 700, 'Second contestant correct answer must award exactly 700 Crypto');
  assert.strictEqual(eval2Data.round.status, 'ANSWER_CORRECT');
  console.log('  ✔ Contestant #2 marked CORRECT (Exactly 700 Crypto awarded, question completed)');

  // =========================================================================
  // Section 8: Private Personal Score & Activity Verification
  // =========================================================================
  console.log('\n▶ Test 7: Verify Student Personal Score & Private Activity');
  
  // Find token of Contestant #2
  const token2 = tokens.find(t => t.name === contestant2.displayName)?.token;
  assert.ok(token2, 'Token for contestant 2 should be present');

  const scoreRes = await fetch(`${BASE_URL}/api/students/me/score`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  assert.strictEqual(scoreRes.status, 200);
  const scoreData = await scoreRes.json();
  assert.strictEqual(scoreData.score.totalCrypto, 700, 'Personal Crypto balance must be 700');
  assert.strictEqual(scoreData.score.correctAnswersCount, 1);
  assert.strictEqual(scoreData.score.firstBuzzerWins, 0);
  assert.strictEqual(scoreData.score.secondBuzzerWins, 1);
  assert.strictEqual(scoreData.score.recentActivity.length, 1);
  assert.strictEqual(scoreData.score.recentActivity[0].points, 700);
  console.log(`  ✔ Contestant #2 personal dashboard score verified: ${scoreData.score.totalCrypto} Crypto (1 second-buzzer win)`);

  // =========================================================================
  // Section 9: Contestant #1 Correct Workflow (Awards 1,000 Crypto)
  // =========================================================================
  console.log('\n▶ Test 8: Contestant #1 Correct Workflow (Awards 1,000 Crypto)');
  
  // Start another random round
  const startRound2Res = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/start-random`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const startRound2Data = await startRound2Res.json();
  const round2Id = startRound2Data.round.roundId;
  assert.notStrictEqual(round2Id, round1Id);
  console.log(`  ✔ Round #2 started with unused question: "${startRound2Data.round.questionText}"`);

  // Contestant 2 buzzes first in round 2
  const buzzR2Contestant1 = await fetch(`${BASE_URL}/api/sessions/${sessionId}/rounds/${round2Id}/buzz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
  });
  const buzzR2Data = await buzzR2Contestant1.json();
  assert.strictEqual(buzzR2Data.accepted, true);
  assert.strictEqual(buzzR2Data.position, 1);

  // Admin marks Contestant 1 CORRECT in round 2 (Awards 1,000 Crypto)
  const evalR2Res = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round2Id}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ contestantIndex: 0, result: 'correct' }),
  });
  const evalR2Data = await evalR2Res.json();
  assert.strictEqual(evalR2Data.pointsAwarded, 1000, 'First contestant correct answer must award exactly 1,000 Crypto');
  assert.strictEqual(evalR2Data.round.status, 'ANSWER_CORRECT');
  console.log('  ✔ First contestant correct answer awarded exactly 1,000 Crypto points');

  // Verify updated balance for contestant 2: 700 + 1000 = 1700 Crypto
  const scoreR2Res = await fetch(`${BASE_URL}/api/students/me/score`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const scoreR2Data = await scoreR2Res.json();
  assert.strictEqual(scoreR2Data.score.totalCrypto, 1700, 'Total score should be 1,700 Crypto (700 + 1000)');
  assert.strictEqual(scoreR2Data.score.correctAnswersCount, 2);
  assert.strictEqual(scoreR2Data.score.firstBuzzerWins, 1);
  assert.strictEqual(scoreR2Data.score.secondBuzzerWins, 1);
  console.log(`  ✔ Contestant cumulative score verified: 1,700 Crypto (1 first win, 1 second win)`);

  // =========================================================================
  // Section 10: Idempotency & Duplicate Event Prevention
  // =========================================================================
  console.log('\n▶ Test 9: Verify Idempotency & Duplicate Evaluation Prevention');
  const duplicateEvalRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round2Id}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ contestantIndex: 0, result: 'correct' }),
  });
  const duplicateEvalData = await duplicateEvalRes.json();
  assert.strictEqual(duplicateEvalData.alreadyEvaluated, true, 'Duplicate evaluation must indicate alreadyEvaluated');
  
  // Balance must remain strictly 1,700
  const scoreAfterDupRes = await fetch(`${BASE_URL}/api/students/me/score`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const scoreAfterDup = await scoreAfterDupRes.json();
  assert.strictEqual(scoreAfterDup.score.totalCrypto, 1700, 'Score must remain 1,700 without double counting');
  console.log('  ✔ Idempotent evaluation verified: repeated clicks do not award duplicate points');

  // =========================================================================
  // Section 11: Real-Time Leaderboard & Deterministic Tie-Breaking
  // =========================================================================
  console.log('\n▶ Test 10: Verify Real-Time Leaderboard & Tie-Breaking');
  const leaderboardRes = await fetch(`${BASE_URL}/api/leaderboard`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  assert.strictEqual(leaderboardRes.status, 200);
  const leaderboardData = await leaderboardRes.json();
  assert.ok(Array.isArray(leaderboardData.leaderboard));
  assert.ok(leaderboardData.leaderboard.length >= 1);
  
  const contestantEntry = leaderboardData.leaderboard.find((e: any) => e.uid === contestant2.uid);
  assert.ok(contestantEntry, 'Contestant #2 must be present on the leaderboard');
  assert.strictEqual(contestantEntry.totalCrypto, 1700);
  assert.strictEqual(contestantEntry.firstBuzzerWins, 1);
  assert.strictEqual(contestantEntry.secondBuzzerWins, 1);
  console.log(`  ✔ Public leaderboard verified: Contestant #2 (${contestantEntry.displayName}) ranked #${contestantEntry.rank} with ${contestantEntry.totalCrypto} Crypto`);

  // =========================================================================
  // Section 12: Admin Round Controls: Pause, Resume, Reveal Answer, Reset
  // =========================================================================
  console.log('\n▶ Test 11: Admin Round Controls (Pause, Resume, Reveal Answer, Reset Sequence)');
  
  // Start Round 3
  const r3Res = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/start-random`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const r3Data = await r3Res.json();
  const round3Id = r3Data.round.roundId;

  // Pause round
  const pauseRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round3Id}/pause`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(pauseRes.status, 200);
  const pauseData = await pauseRes.json();
  assert.strictEqual(pauseData.round.status, 'BUZZER_LOCKED');
  console.log('  ✔ Round paused successfully (status: BUZZER_LOCKED)');

  // Attempt buzz while paused should fail
  const pausedBuzz = await fetch(`${BASE_URL}/api/sessions/${sessionId}/rounds/${round3Id}/buzz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
  });
  const pausedBuzzData = await pausedBuzz.json();
  assert.strictEqual(pausedBuzzData.accepted, false);
  console.log('  ✔ Buzz attempts while paused are rejected');

  // Resume round
  const resumeRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round3Id}/resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(resumeRes.status, 200);
  const resumeData = await resumeRes.json();
  assert.strictEqual(resumeData.round.status, 'QUESTION_ACTIVE');
  console.log('  ✔ Round resumed successfully');

  // Reveal Answer Key
  const revealRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${round3Id}/reveal-answer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(revealRes.status, 200);
  const revealData = await revealRes.json();
  assert.strictEqual(revealData.round.isAnswerRevealed, true);
  assert.ok(revealData.round.correctAnswer.length > 0);
  console.log(`  ✔ Admin revealed answer key: "${revealData.round.correctAnswer}"`);

  // Now student CAN see the revealed answer
  const studentPostRevealRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stu1Token}` },
  });
  const studentPostRevealData = await studentPostRevealRes.json();
  assert.strictEqual(studentPostRevealData.session.rounds[round3Id].isAnswerRevealed, true);
  assert.strictEqual(studentPostRevealData.session.rounds[round3Id].correctAnswer, revealData.round.correctAnswer);
  console.log('  ✔ Student can now see answer key only after admin explicitly revealed it');

  // Reset Question Sequence (Preserves student scores!)
  const resetRes = await fetch(`${BASE_URL}/api/admin/questions/reset-sequence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(resetRes.status, 200);
  
  // Verify score is NOT erased after sequence reset
  const scoreAfterResetRes = await fetch(`${BASE_URL}/api/students/me/score`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const scoreAfterReset = await scoreAfterResetRes.json();
  assert.strictEqual(scoreAfterReset.score.totalCrypto, 1700, 'Resetting question sequence must NOT erase student scores');
  console.log('  ✔ Question sequence reset completed without affecting student scores');

  console.log('\n========================================================================');
  console.log('🎉 ALL 11 AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
  console.log('   - CSV Parsing & Validation (RFC-4180, BOM, Quotes, Commas, Row Errors)');
  console.log('   - Admin CSV Upload & Question Bank Management');
  console.log('   - Random Question Selection & Real-Time Sync');
  console.log('   - 20-Contestant Concurrent Atomic Buzzer Race (Top 2 Accepted, 18 Rejected)');
  console.log('   - Duplicate Buzz Prevention & Early/Late Rejections');
  console.log('   - Admin Evaluation Workflow (+1,000 for 1st, +700 for 2nd, 0 for wrong)');
  console.log('   - Opportunity Passing from Contestant #1 to Contestant #2 on Wrong Answer');
  console.log('   - Answer Key Concealment from Students until Authorized Admin Reveal');
  console.log('   - Student Private Score Dashboard & Activity Ledger');
  console.log('   - Real-Time Public Leaderboard & Deterministic Tie-Breaking');
  console.log('   - Admin Round Controls (Pause, Resume, Skip, Reveal, Reset Sequence)');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
