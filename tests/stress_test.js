/**
 * DormSphere Stress Test
 * Simulates 50-100 concurrent room selection requests
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

async function registerAndLogin(index) {
  const email = `stress_test_${index}_${Date.now()}@test.com`;
  const password = 'testpass123';
  
  // Register
  await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rollNumber: `STRESS-${String(index).padStart(4, '0')}`,
      name: `Stress Test ${index}`,
      email,
      password,
      year: (index % 4) + 1,
      department: 'TEST',
    }),
  });

  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await loginRes.json();
  return data.token;
}

async function attemptRoomSelection(token, roomId) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/rooms/${roomId}/attempt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const elapsed = Date.now() - start;
  const data = await res.json();
  return { status: res.status, data, elapsed };
}

async function main() {
  const CONCURRENT_USERS = parseInt(process.argv[2] || '50');
  
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        DormSphere — Concurrent Room Selection Test      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n🔧 Registering ${CONCURRENT_USERS} test users...`);

  // First, get available rooms
  const roomsRes = await fetch(`${BASE_URL}/api/rooms`);
  const { rooms } = await roomsRes.json();
  const availableRooms = rooms.filter(r => r.is_available);
  
  if (availableRooms.length === 0) {
    console.error('❌ No available rooms found!');
    process.exit(1);
  }

  // Pick one room for maximum contention
  const targetRoom = availableRooms[0];
  console.log(`🎯 Target room: ${targetRoom.room_number} (capacity: ${targetRoom.capacity})`);

  // Register users and get tokens
  const tokens = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    try {
      const token = await registerAndLogin(i);
      tokens.push(token);
    } catch (err) {
      console.warn(`  ⚠ User ${i} registration failed`);
    }
  }
  console.log(`✅ ${tokens.length} users registered\n`);

  // Concurrent selection
  console.log(`🚀 Launching ${tokens.length} concurrent selections on room ${targetRoom.room_number}...`);
  const startTime = Date.now();

  const results = await Promise.all(
    tokens.map(token => attemptRoomSelection(token, targetRoom.id))
  );

  const totalElapsed = Date.now() - startTime;

  // Analyze
  const successes = results.filter(r => r.status === 200);
  const conflicts = results.filter(r => r.status === 409);
  const errors = results.filter(r => r.status >= 500);
  const avgLatency = results.reduce((sum, r) => sum + r.elapsed, 0) / results.length;

  console.log('\n📊 Results:');
  console.log(`  ✅ Successful bookings: ${successes.length}`);
  console.log(`  ❌ Correctly rejected (room full): ${conflicts.length}`);
  console.log(`  💥 Server errors: ${errors.length}`);
  console.log(`  ⏱️  Total time: ${totalElapsed}ms`);
  console.log(`  ⏱️  Avg latency: ${avgLatency.toFixed(1)}ms`);
  console.log(`  🎯 Expected max bookings: ${targetRoom.capacity}`);

  const passed = successes.length <= targetRoom.capacity && errors.length === 0;
  console.log(`\n${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}: ${
    passed ? 'No double bookings, all conflicts handled correctly' : 'DOUBLE BOOKING DETECTED or server errors occurred'
  }`);

  // Output JSON for CI
  const output = {
    concurrent_users: tokens.length,
    target_room: targetRoom.room_number,
    capacity: targetRoom.capacity,
    successes: successes.length,
    rejected: conflicts.length,
    errors: errors.length,
    total_ms: totalElapsed,
    avg_latency_ms: parseFloat(avgLatency.toFixed(1)),
    passed,
  };
  console.log('\n' + JSON.stringify(output, null, 2));
}

main().catch(console.error);
