-- DormSphere Seed Data
-- 4 hostels, 200 rooms, 100 students with lifestyle vectors

-- =====================================================
-- HOSTELS
-- =====================================================
INSERT INTO hostels (id, name, code, total_rooms, floors) VALUES
('a0000001-0000-0000-0000-000000000001', 'MVHR Hostel', 'MVHR', 342, 9),
('a0000001-0000-0000-0000-000000000002', 'Srinivasa Ramanujan Hall', 'SRINIVASA', 200, 5);

-- =====================================================
-- ROOMS
-- =====================================================
DO $$
DECLARE
    mvhr_id UUID := 'a0000001-0000-0000-0000-000000000001';
    srinivasa_id UUID := 'a0000001-0000-0000-0000-000000000002';
    f INT;
    r INT;
    room_num TEXT;
BEGIN
    ---------- MVHR Hostel (9 Floors) ----------
    FOR f IN 1..9 LOOP
        -- Wing A: 24 rooms/floor (101-124), Capacity: 1
        FOR r IN 1..24 LOOP
            room_num := f || '1' || FORMAT('%02s', r);
            INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
            VALUES (mvhr_id, f, room_num, 1, 0, true);
        END LOOP;
        
        -- Wing B: 14 rooms/floor (201-214), Capacity: 2
        FOR r IN 1..14 LOOP
            room_num := f || '2' || FORMAT('%02s', r);
            INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
            VALUES (mvhr_id, f, room_num, 2, 0, true);
        END LOOP;
    END LOOP;

    ---------- Srinivasa Ramanujan Hall (5 Floors) ----------
    FOR f IN 1..5 LOOP
        -- Wing A: 20 rooms/floor (101-120), Capacity: 1
        FOR r IN 1..20 LOOP
            room_num := f || '1' || FORMAT('%02s', r);
            INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
            VALUES (srinivasa_id, f, room_num, 1, 0, true);
        END LOOP;
        
        -- Wing B: 20 rooms/floor (201-220), Capacity: 2
        FOR r IN 1..20 LOOP
            room_num := f || '2' || FORMAT('%02s', r);
            INSERT INTO rooms (hostel_id, floor, room_number, capacity, occupied, is_available)
            VALUES (srinivasa_id, f, room_num, 2, 0, true);
        END LOOP;
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

    -- Assign a previous room ID to all Seniors (Years 3, 4, 5) simulating previous living space
    UPDATE students
    SET previous_room_id = (SELECT id FROM rooms ORDER BY RANDOM() LIMIT 1)
    WHERE year >= 3;

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
