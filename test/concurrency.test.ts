import assert from 'node:assert';

// Comprehensive QuickBuzz concurrency and authorization test suite
const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000';

async function runTests() {
  console.log('🧪 Starting QuickBuzz Automated Concurrency & Security Test Suite...\n');

  // Test 1: Admin Authentication
  console.log('▶ Test 1: Authenticate Admin Account');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'fardinrit@gmail.com', password: 'Fardin@RIT07' }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login failed');
  const adminData = await adminLoginRes.json();
  assert.strictEqual(adminData.user.role, 'admin', 'User must have role admin');
  const adminToken = adminData.token;
  console.log('  ✔ Admin authenticated successfully with role: admin');

  // Test 2: Provision & Authenticate Student Accounts
  console.log('\n▶ Test 2: Provision & Authenticate Test Student Accounts');
  // Admin creates test accounts dynamically
  await fetch(`${BASE_URL}/api/admin/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ displayName: 'Test Contestant 1', studentId: '1MS21CS042', email: 'alex.turner@campus.edu', password: 'password123' }),
  });
  await fetch(`${BASE_URL}/api/admin/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ displayName: 'Test Contestant 2', studentId: '1MS21CS088', email: 'priya.sharma@campus.edu', password: 'password123' }),
  });
  await fetch(`${BASE_URL}/api/admin/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ displayName: 'Test Contestant 3', studentId: '1MS21CS019', email: 'david.chen@campus.edu', password: 'password123' }),
  });

  const stu1Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '1MS21CS042', password: 'password123' }),
  });
  assert.strictEqual(stu1Res.status, 200, 'Student 1 login failed');
  const stu1Data = await stu1Res.json();
  assert.strictEqual(stu1Data.user.role, 'student');
  const stu1Token = stu1Data.token;

  const stu2Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '1MS21CS088', password: 'password123' }),
  });
  assert.strictEqual(stu2Res.status, 200, 'Student 2 login failed');
  const stu2Data = await stu2Res.json();
  const stu2Token = stu2Data.token;

  const stu3Res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '1MS21CS019', password: 'password123' }),
  });
  assert.strictEqual(stu3Res.status, 200, 'Student 3 login failed');
  const stu3Data = await stu3Res.json();
  const stu3Token = stu3Data.token;
  console.log('  ✔ 3 Test Contestant accounts provisioned and logged in successfully');

  // Test 3: Disabled Student Account Enforcement
  console.log('\n▶ Test 3: Disabled Account Security Check');
  const disabledCreated = await fetch(`${BASE_URL}/api/admin/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ displayName: 'Disabled Student', studentId: '1MS21CS105', email: 'marcus.vance@campus.edu', password: 'password123' }),
  });
  const disabledStudentData = await disabledCreated.json();
  const disabledUid = disabledStudentData.student?.uid;
  if (disabledUid) {
    await fetch(`${BASE_URL}/api/admin/students/${disabledUid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ accountStatus: 'disabled' }),
    });
  }

  const disabledRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '1MS21CS105', password: 'password123' }),
  });
  assert.strictEqual(disabledRes.status, 403, 'Disabled account must be denied login');
  console.log('  ✔ Disabled account was strictly blocked (HTTP 403)');

  // Test 4: Admin creates a fresh test session
  console.log('\n▶ Test 4: Create Isolated Quiz Session');
  const sessionRes = await fetch(`${BASE_URL}/api/admin/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ title: 'Automated Concurrency Stress Test', customCode: 'TEST99' }),
  });
  assert.strictEqual(sessionRes.status, 201, 'Failed to create test session');
  const sessionData = await sessionRes.json();
  const sessionId = sessionData.session.sessionId;
  console.log(`  ✔ Created Session ID: ${sessionId} (PIN: TEST99)`);

  // Test 5: Open a new buzzer round
  console.log('\n▶ Test 5: Open Buzzer Round #1');
  const openRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ questionText: 'Concurrency Test: What is 2 + 2?', roundNumber: 1 }),
  });
  assert.strictEqual(openRes.status, 200, 'Failed to open round');
  const openData = await openRes.json();
  const roundId = openData.round.roundId;
  assert.strictEqual(openData.round.status, 'OPEN');
  console.log(`  ✔ Round ${roundId} opened with status: OPEN`);

  // Test 6: CONCURRENT MILLISECOND BUZZ RACE USING PASSWORDLESS QUICK JOIN
  console.log('\n▶ Test 6: Execute 20 Concurrent Simultaneous Buzz Requests (Passwordless Quick-Join)');
  // Contestants quick-join with Name and PIN TEST99
  const tokens: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const quickJoinRes = await fetch(`${BASE_URL}/api/sessions/quick-join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Contestant ${i}`,
        sessionPin: 'TEST99',
        studentId: `USN-${100 + i}`,
      }),
    });
    assert.strictEqual(quickJoinRes.status, 200, `Quick-join failed for student ${i}`);
    const qData = await quickJoinRes.json();
    tokens.push(qData.token);
  }

  console.log(`  Successfully quick-joined ${tokens.length} contestants with Name & PIN (No passwords needed).`);
  console.log('  Firing 20 simultaneous POST requests with Promise.all()...');

  const buzzPromises = tokens.map(t =>
    fetch(`${BASE_URL}/api/sessions/${sessionId}/rounds/${roundId}/buzz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
      },
    }).then(r => r.json())
  );

  const results = await Promise.all(buzzPromises);

  const acceptedWinners = results.filter(r => r.accepted === true);
  const rejectedTooLate = results.filter(r => r.accepted === false && r.reason === 'TOO_LATE');

  console.log(`  Results received: ${results.length} total responses`);
  console.log(`  Accepted winners: ${acceptedWinners.length}`);
  console.log(`  Rejected (too late): ${rejectedTooLate.length}`);

  // CRITICAL ASSERTION: EXACTLY ONE WINNER
  assert.strictEqual(acceptedWinners.length, 1, 'CRITICAL: Exactly ONE winner must be accepted!');
  assert.strictEqual(rejectedTooLate.length, tokens.length - 1, 'All other contestants must be rejected as TOO_LATE');
  console.log(`  ✔ ATOMIC RACE GUARANTEE PASSED! Winner: ${acceptedWinners[0].winner?.name} (${acceptedWinners[0].winner?.studentId})`);

  // Test 7: Verify round record in session state
  console.log('\n▶ Test 7: Verify Authoritative Round State in Database');
  const getSessionRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const currentSessionData = await getSessionRes.json();
  const recordedRound = currentSessionData.session.rounds[roundId];
  assert.strictEqual(recordedRound.status, 'WINNER_LOCKED', 'Round must be WINNER_LOCKED');
  assert.strictEqual(recordedRound.winnerStudentId, acceptedWinners[0].winner?.studentId);
  console.log(`  ✔ Database confirms WINNER_LOCKED with recorded attempts: ${recordedRound.attempts.length}`);

  // Test 8: Close Round and Attempt Subsequent Buzz
  console.log('\n▶ Test 8: Close Round & Reject Further Submissions');
  const closeRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}/rounds/${roundId}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(closeRes.status, 200);

  const lateBuzz = await fetch(`${BASE_URL}/api/sessions/${sessionId}/rounds/${roundId}/buzz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${stu1Token}`,
    },
  });
  const lateData = await lateBuzz.json();
  assert.strictEqual(lateData.accepted, false);
  console.log('  ✔ Submissions after round closure were rejected as expected');

  console.log('\n======================================================');
  console.log('🎉 ALL 8 AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
