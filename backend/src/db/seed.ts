import bcrypt from 'bcryptjs';
import { query } from './connection';
import { parseIdentity } from '../utils/parseIdentity';

export async function seedDatabase(): Promise<void> {
  // Community tables were originally added via a one-off script.
  // Ensure they exist in every environment before the app starts serving traffic.
  await query(`
    CREATE TABLE IF NOT EXISTS lost_and_found (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_type VARCHAR(10) CHECK (item_type IN ('lost', 'found')),
      title VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      location VARCHAR(100),
      image_url TEXT,
      reported_by UUID NOT NULL REFERENCES students(id),
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'resolved')),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public_grievances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id),
      title VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50),
      is_anonymous BOOLEAN DEFAULT false,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP,
      resolved_by UUID REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS grievance_upvotes (
      grievance_id UUID NOT NULL REFERENCES public_grievances(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id),
      PRIMARY KEY (grievance_id, student_id)
    );
  `);

  // Only seed hostels/students if the hostels table is empty
  const { rows } = await query('SELECT COUNT(*) AS cnt FROM hostels');
  const hostelsExist = parseInt(rows[0].cnt, 10) > 0;

  const ensureWaves = async (isActive: boolean): Promise<void> => {
    const { rows: waveRows } = await query('SELECT COUNT(*) AS cnt FROM waves');
    if (parseInt(waveRows[0].cnt, 10) > 0) return;

    console.log('🌊 Waves missing. Injecting Year 1-5 waves...');
    const waveDefs = [
      { name: 'Year 5 — Senior Priority', yearGroup: 5 },
      { name: 'Year 4 — Pre-Final Year', yearGroup: 4 },
      { name: 'Year 3 — Third Year', yearGroup: 3 },
      { name: 'Year 2 — Sophomores', yearGroup: 2 },
      { name: 'Year 1 — Freshers', yearGroup: 1 },
    ];
    for (const w of waveDefs) {
      await query(
        'INSERT INTO waves (name, year_group, gate_open, gate_close, is_active, status) VALUES ($1, $2, NOW(), NOW() + INTERVAL \'30 days\', $3, $4)',
        [w.name, w.yearGroup, isActive, isActive ? 'active' : 'pending'],
      );
    }
    console.log('✅ 5 waves injected.');
  };

  if (hostelsExist) {
    await ensureWaves(false);
    console.log('📦 Database already seeded');
    return;
  }

  console.log('🌱 Seeding database...');

  // --- Hostels ---
  const hostelIds = [
    'a0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000004',
  ];
  const hostelData = [
    { name: 'MVHR Block A', code: 'MVHR-A' },
    { name: 'MVHR Block B', code: 'MVHR-B' },
    { name: 'MVHR Block C', code: 'MVHR-C' },
    { name: 'MVHR Block D', code: 'MVHR-D' },
  ];

  for (let i = 0; i < hostelData.length; i++) {
    await query(
      'INSERT INTO hostels (id, name, code, total_rooms, floors) VALUES ($1, $2, $3, 50, 3)',
      [hostelIds[i], hostelData[i].name, hostelData[i].code],
    );
  }

  // --- Rooms (200+ total) ---
  for (const hId of hostelIds) {
    for (let floor = 1; floor <= 3; floor++) {
      for (let r = 1; r <= 17; r++) {
        const roomNum = `${floor}${String(r).padStart(2, '0')}`;
        await query(
          'INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available) VALUES ($1, $2, $3, 2, 0, true)',
          [hId, floor, roomNum],
        );
      }
    }
    // Extra single rooms
    await query('INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available) VALUES ($1, 1, $2, 1, 0, true)', [hId, '100']);
    await query('INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available) VALUES ($1, 2, $2, 1, 0, true)', [hId, '200']);
  }

  // --- Students ---
  // Realistic IIITDM Kurnool roll numbers: (1|5)(batch)(branch)(serial)
  // In 2026: batch 21→Yr5, 22→Yr4, 23→Yr3, 24→Yr2, 25→Yr1
  const passwordHash = await bcrypt.hash('dormsphere123', 10);
  const batches = [21, 22, 23, 24, 25];
  const branches = ['CS', 'EC', 'ME', 'AD'];
  let serial = 1;

  for (const batch of batches) {
    for (const branch of branches) {
      // 50 B.Tech students per branch per batch
      for (let s = 1; s <= 50; s++) {
        const rollNumber = `1${batch}${branch}${String(serial).padStart(4, '0')}`;
        const email = `${rollNumber.toLowerCase()}@iiitk.ac.in`;
        const identity = parseIdentity(email, rollNumber);
        if (!identity) { serial++; continue; }

        await query(
          `INSERT INTO students (roll_number, name, email, password_hash, role, department, branch, degree_type, year_group)
           VALUES ($1, $2, $3, $4, 'student', $5, $6, $7, $8)`,
          [rollNumber, `Student ${serial}`, email, passwordHash, identity.branchName, identity.branch, identity.degreeType, identity.yearGroup],
        );
        serial++;
      }

      // 2 Dual Degree students per branch per batch (except AD — no dual)
      if (branch !== 'AD') {
        for (let s = 1; s <= 2; s++) {
          const rollNumber = `5${batch}${branch}${String(serial).padStart(4, '0')}`;
          const email = `${rollNumber.toLowerCase()}@iiitk.ac.in`;
          const identity = parseIdentity(email, rollNumber);
          if (!identity) { serial++; continue; }

          await query(
            `INSERT INTO students (roll_number, name, email, password_hash, role, department, branch, degree_type, year_group)
             VALUES ($1, $2, $3, $4, 'student', $5, $6, $7, $8)`,
            [rollNumber, `DualDeg ${branch}-${s}`, email, passwordHash, identity.branchName, identity.branch, identity.degreeType, identity.yearGroup],
          );
          serial++;
        }
      }
    }
  }

  // Staff and admin users (name-based emails → role: 'admin')
  // Name-based email prefix does NOT match the roll regex → auto-detected as admin
  const adminUsers = [
    { roll: 'ADMIN-001', name: 'Sanjay Singh', email: 'sanjay.singh@iiitk.ac.in', role: 'admin', dept: 'Administration' },
    { roll: 'ADMIN-002', name: 'Priya Sharma', email: 'priya.sharma@iiitk.ac.in', role: 'admin', dept: 'Administration' },
    { roll: 'WARDEN-001', name: 'Dr. Ramesh Kumar', email: 'warden@iiitk.ac.in', role: 'admin', dept: 'Hostel Affairs' },
    { roll: 'GUARD-001', name: 'Suresh Security', email: 'guard@iiitk.ac.in', role: 'guard', dept: 'Security' },
    { roll: 'JUDCOMM-001', name: 'JudComm Chair', email: 'judcomm@iiitk.ac.in', role: 'judcomm', dept: 'Student Council' },
  ];
  for (const u of adminUsers) {
    await query(
      'INSERT INTO students (roll_number, name, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5, $6)',
      [u.roll, u.name, u.email, passwordHash, u.role, u.dept],
    );
  }

  // --- Infrastructure Status ---
  for (const hId of hostelIds) {
    const wifi = 85 + Math.floor(Math.random() * 15);
    await query(
      'INSERT INTO infra_status (hostel_id, wifi_strength, power_status, water_status) VALUES ($1, $2, $3, $4)',
      [hId, wifi, 'on', 'on'],
    );
  }

  // --- Shared Assets ---
  const assetTemplates = [
    { name: 'Washing Machine', category: 'laundry', total: 4 },
    { name: 'Iron Press', category: 'laundry', total: 3 },
    { name: 'Cricket Kit', category: 'sports', total: 2 },
    { name: 'Football', category: 'sports', total: 5 },
    { name: 'Badminton Set', category: 'sports', total: 3 },
    { name: 'Extension Board', category: 'electronics', total: 6 },
    { name: 'Study Table Lamp', category: 'electronics', total: 8 },
  ];
  for (const hId of hostelIds) {
    for (const a of assetTemplates) {
      await query(
        'INSERT INTO assets (hostel_id, name, category, total_count, available_count) VALUES ($1, $2, $3, $4, $5)',
        [hId, a.name, a.category, a.total, a.total],
      );
    }
  }

  // --- Sample Election ---
  await query(
    "INSERT INTO elections (title, description, election_type, start_time, end_time, is_active) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days', true)",
    ['Block A Representative 2026', 'Elect your block representative for Spring 2026', 'block_rep'],
  );

  await ensureWaves(true);

  const totalStudents = serial - 1;
  console.log(`✅ Database seeded: 4 hostels, 200+ rooms, ${totalStudents} students, 5 waves, assets, infrastructure`);
}
