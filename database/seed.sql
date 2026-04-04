-- DormSphere Seed Data
-- 4 hostels, 200 rooms, 100 students with lifestyle vectors

-- =====================================================
-- HOSTELS
-- =====================================================
INSERT INTO hostels (id, name, code, total_rooms, floors) VALUES
('a0000001-0000-0000-0000-000000000001', 'MVHR Block A', 'MVHR-A', 50, 3),
('a0000001-0000-0000-0000-000000000002', 'MVHR Block B', 'MVHR-B', 50, 3),
('a0000001-0000-0000-0000-000000000003', 'MVHR Block C', 'MVHR-C', 50, 3),
('a0000001-0000-0000-0000-000000000004', 'MVHR Block D', 'MVHR-D', 50, 3);

-- =====================================================
-- ROOMS (200 rooms across 4 hostels)
-- =====================================================
DO $$
DECLARE
    hostel_ids UUID[] := ARRAY[
        'a0000001-0000-0000-0000-000000000001',
        'a0000001-0000-0000-0000-000000000002',
        'a0000001-0000-0000-0000-000000000003',
        'a0000001-0000-0000-0000-000000000004'
    ];
    h_id UUID;
    h_idx INT;
    f INT;
    r INT;
    room_num TEXT;
BEGIN
    FOR h_idx IN 1..4 LOOP
        h_id := hostel_ids[h_idx];
        FOR f IN 1..3 LOOP
            FOR r IN 1..17 LOOP
                room_num := f || FORMAT('%02s', r);
                INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
                VALUES (h_id, f, room_num, 2, 0, true);
            END LOOP;
        END LOOP;
        -- Add 1 extra single room per floor for odd count
        INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
        VALUES (h_id, 1, '100', 1, 0, true);
        INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
        VALUES (h_id, 2, '200', 1, 0, true);
    END LOOP;
END $$;

-- =====================================================
-- SAMPLE STUDENTS (100 with hashed passwords)
-- password: 'dormsphere123' for all
-- =====================================================
DO $$
DECLARE
    i INT;
    s_id UUID;
    roll TEXT;
    dept TEXT;
    yr INT;
    departments TEXT[] := ARRAY['CSE', 'ECE', 'ME', 'CE', 'DS'];
BEGIN
    FOR i IN 1..100 LOOP
        s_id := uuid_generate_v4();
        yr := (i % 4) + 1;
        dept := departments[(i % 5) + 1];
        roll := 'IIITDMK-' || FORMAT('%04s', i);
        
        INSERT INTO students (id, roll_number, name, email, password_hash, role, year, department)
        VALUES (
            s_id,
            roll,
            'Student ' || i,
            'student' || i || '@iiitdm.ac.in',
            '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36DRyBwSRQfgsg4UfVDlGXu', -- bcrypt hash
            'student',
            yr,
            dept
        );

        -- Insert lifestyle vector with semi-random values
        INSERT INTO vectors (student_id, sleep, study, social, raw_answers)
        VALUES (
            s_id,
            ROUND((RANDOM() * 8 + 2)::numeric, 1),  -- 2-10
            ROUND((RANDOM() * 8 + 2)::numeric, 1),
            ROUND((RANDOM() * 8 + 2)::numeric, 1),
            '{"q1":"sample","q2":"sample"}'::jsonb
        );
    END LOOP;
END $$;

-- =====================================================
-- WARDEN & GUARD accounts
-- =====================================================
INSERT INTO students (roll_number, name, email, password_hash, role, year, department)
VALUES
('WARDEN-001', 'Dr. Ramesh Kumar', 'warden@iiitdm.ac.in', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36DRyBwSRQfgsg4UfVDlGXu', 'warden', NULL, 'Admin'),
('GUARD-001', 'Suresh Security', 'guard@iiitdm.ac.in', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36DRyBwSRQfgsg4UfVDlGXu', 'guard', NULL, 'Security'),
('JUDCOMM-001', 'JudComm Chair', 'judcomm@iiitdm.ac.in', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36DRyBwSRQfgsg4UfVDlGXu', 'judcomm', NULL, 'Admin');

-- =====================================================
-- INFRASTRUCTURE STATUS
-- =====================================================
INSERT INTO infra_status (hostel_id, wifi_strength, power_status, water_status)
SELECT id, 85 + FLOOR(RANDOM() * 15)::INT, 'on', 'on'
FROM hostels;

-- =====================================================
-- SHARED ASSETS
-- =====================================================
INSERT INTO assets (hostel_id, name, category, total_count, available_count)
SELECT h.id, a.name, a.category, a.total, a.total
FROM hostels h,
(VALUES
    ('Washing Machine', 'laundry', 4),
    ('Iron Press', 'laundry', 3),
    ('Cricket Kit', 'sports', 2),
    ('Football', 'sports', 5),
    ('Badminton Set', 'sports', 3),
    ('Extension Board', 'electronics', 6),
    ('Study Table Lamp', 'electronics', 8)
) AS a(name, category, total);

-- =====================================================
-- SAMPLE ELECTION
-- =====================================================
INSERT INTO elections (title, description, election_type, start_time, end_time, is_active)
VALUES ('Block A Representative 2026', 'Elect your block representative for Spring 2026', 'block_rep', NOW(), NOW() + INTERVAL '7 days', true);
