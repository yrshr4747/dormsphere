import bcrypt from 'bcryptjs';
import Student from '../models/Student';
import Hostel from '../models/Hostel';
import Room from '../models/Room';
import InfraStatus from '../models/InfraStatus';
import { Asset } from '../models/Asset';
import { Election } from '../models/Election';

export async function seedDatabase(): Promise<void> {
  // Only seed if empty
  const hostelCount = await Hostel.countDocuments();
  if (hostelCount > 0) {
    console.log('📦 Database already seeded');
    return;
  }

  console.log('🌱 Seeding database...');

  // --- Hostels ---
  const hostels = await Hostel.insertMany([
    { name: 'MVHR Block A', code: 'MVHR-A', totalRooms: 50, floors: 3 },
    { name: 'MVHR Block B', code: 'MVHR-B', totalRooms: 50, floors: 3 },
    { name: 'MVHR Block C', code: 'MVHR-C', totalRooms: 50, floors: 3 },
    { name: 'MVHR Block D', code: 'MVHR-D', totalRooms: 50, floors: 3 },
  ]);

  // --- Rooms (200 total) ---
  const roomDocs: any[] = [];
  for (const hostel of hostels) {
    for (let floor = 1; floor <= 3; floor++) {
      for (let r = 1; r <= 17; r++) {
        roomDocs.push({
          hostelId: hostel._id,
          floor,
          roomNumber: `${floor}${String(r).padStart(2, '0')}`,
          capacity: 2,
          occupied: 0,
          isAvailable: true,
        });
      }
    }
    // 1 single room per floor for some variety
    roomDocs.push({ hostelId: hostel._id, floor: 1, roomNumber: '100', capacity: 1, occupied: 0, isAvailable: true });
    roomDocs.push({ hostelId: hostel._id, floor: 2, roomNumber: '200', capacity: 1, occupied: 0, isAvailable: true });
  }
  await Room.insertMany(roomDocs);

  // --- Students (100 B.Tech + some Dual Degree) ---
  const passwordHash = await bcrypt.hash('dormsphere123', 10);
  const branches = ['CS', 'EC', 'ME', 'AD'];
  const branchNames = { CS: 'CSE', EC: 'ECE', ME: 'ME', AD: 'AD' };
  const studentDocs: any[] = [];
  let serial = 1;

  // B.Tech students (prefix 1): 25 per branch across years 2021-2024
  for (const year of [21, 22, 23, 24]) {
    for (const branch of branches) {
      for (let s = 1; s <= 6; s++) {
        const rollNumber = `1${year}${branch}${String(serial % 100).padStart(4, '0')}`;
        studentDocs.push({
          rollNumber,
          name: `Student ${serial}`,
          email: `student${serial}@iiitk.ac.in`,
          passwordHash,
          role: 'student',
          year: 2000 + year,
          department: (branchNames as any)[branch],
        });
        serial++;
      }
    }
  }

  // Dual Degree students (prefix 5): CS, EC, ME only (not AD)
  for (const branch of ['CS', 'EC', 'ME']) {
    for (let s = 1; s <= 2; s++) {
      const rollNumber = `523${branch}${String(s).padStart(4, '0')}`;
      studentDocs.push({
        rollNumber,
        name: `DualDeg ${branch}-${s}`,
        email: `dual${branch.toLowerCase()}${s}@iiitk.ac.in`,
        passwordHash,
        role: 'student',
        year: 2023,
        department: (branchNames as any)[branch],
      });
    }
  }

  // Warden, Guard, JudComm
  studentDocs.push(
    { rollNumber: 'WARDEN-001', name: 'Dr. Ramesh Kumar', email: 'warden@iiitk.ac.in', passwordHash, role: 'warden', department: 'Admin' },
    { rollNumber: 'GUARD-001', name: 'Suresh Security', email: 'guard@iiitk.ac.in', passwordHash, role: 'guard', department: 'Security' },
    { rollNumber: 'JUDCOMM-001', name: 'JudComm Chair', email: 'judcomm@iiitk.ac.in', passwordHash, role: 'judcomm', department: 'Admin' },
  );
  await Student.insertMany(studentDocs);

  // --- Infrastructure Status ---
  const infraDocs = hostels.map((h) => ({
    hostelId: h._id,
    wifiStrength: 85 + Math.floor(Math.random() * 15),
    powerStatus: 'on' as const,
    waterStatus: 'on' as const,
  }));
  await InfraStatus.insertMany(infraDocs);

  // --- Shared Assets ---
  const assetTemplates = [
    { name: 'Washing Machine', category: 'laundry', totalCount: 4 },
    { name: 'Iron Press', category: 'laundry', totalCount: 3 },
    { name: 'Cricket Kit', category: 'sports', totalCount: 2 },
    { name: 'Football', category: 'sports', totalCount: 5 },
    { name: 'Badminton Set', category: 'sports', totalCount: 3 },
    { name: 'Extension Board', category: 'electronics', totalCount: 6 },
    { name: 'Study Table Lamp', category: 'electronics', totalCount: 8 },
  ];
  const assetDocs: any[] = [];
  for (const hostel of hostels) {
    for (const tmpl of assetTemplates) {
      assetDocs.push({ hostelId: hostel._id, ...tmpl, availableCount: tmpl.totalCount });
    }
  }
  await Asset.insertMany(assetDocs);

  // --- Sample Election ---
  await Election.create({
    title: 'Block A Representative 2026',
    description: 'Elect your block representative for Spring 2026',
    electionType: 'block_rep',
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isActive: true,
  });

  console.log('✅ Database seeded: 4 hostels, 200 rooms, 103 users, assets, infrastructure');
}
