-- DormSphere Schema v1.0
-- PostgreSQL 16+

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ACTIVITY LOGS (Chief Warden Dashboard)
-- =====================================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SYSTEM SETTINGS (KV Store)
-- =====================================================
CREATE TABLE sys_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- STUDENTS
-- =====================================================
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roll_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'warden', 'guard', 'judcomm')),
    year INT CHECK (year BETWEEN 1 AND 5),
    department VARCHAR(50),
    branch VARCHAR(2) CHECK (branch IN ('CS', 'EC', 'ME', 'AD')),
    degree_type VARCHAR(20) CHECK (degree_type IN ('B.Tech', 'Dual Degree')),
    year_group INT CHECK (year_group BETWEEN 1 AND 5),  -- computed: CURRENT_YEAR - batch_year
    designation VARCHAR(100) DEFAULT 'Student',
    profile_image_url VARCHAR(255),
    phone VARCHAR(15),
    retention_status VARCHAR(20) DEFAULT 'none' CHECK (retention_status IN ('none', 'retained', 'released')),
    previous_room_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- LIFESTYLE VECTORS (Personality Survey Data)
-- =====================================================
CREATE TABLE vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sleep DECIMAL(4,2) NOT NULL CHECK (sleep BETWEEN 0 AND 10),
    study DECIMAL(4,2) NOT NULL CHECK (study BETWEEN 0 AND 10),
    social DECIMAL(4,2) NOT NULL CHECK (social BETWEEN 0 AND 10),
    raw_answers JSONB,  -- original survey responses
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- HOSTELS & ROOMS
-- =====================================================
CREATE TABLE hostels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,  -- e.g., 'MVHR-A'
    total_rooms INT NOT NULL DEFAULT 0,
    floors INT NOT NULL DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    floor INT NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity BETWEEN 1 AND 4),
    occupied INT NOT NULL DEFAULT 0 CHECK (occupied >= 0),
    is_available BOOLEAN NOT NULL DEFAULT true,
    amenities JSONB DEFAULT '[]',
    UNIQUE (hostel_id, room_number),
    CHECK (occupied <= capacity)
);

-- =====================================================
-- ROOMMATE MATCHES (Gale-Shapley output)
-- =====================================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_a UUID NOT NULL REFERENCES students(id),
    student_b UUID NOT NULL REFERENCES students(id),
    compatibility_score DECIMAL(5,2) NOT NULL CHECK (compatibility_score BETWEEN 0 AND 100),
    wave_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (student_a <> student_b)
);

-- =====================================================
-- ROOMMATE PAIRINGS (Mutual Consent Handshakes)
-- =====================================================
CREATE TABLE roommate_pairings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(inviter_id, invitee_id),
    CHECK (inviter_id <> invitee_id)
);

-- =====================================================
-- LOTTERY RANKS
-- =====================================================
CREATE TABLE lottery_ranks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    seed VARCHAR(100) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    rank INT NOT NULL,
    wave_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (student_id, seed)
);

-- =====================================================
-- ROOM SELECTION (Atomic booking)
-- =====================================================
CREATE TABLE room_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID UNIQUE NOT NULL REFERENCES students(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    wave_id UUID
);

CREATE TABLE selection_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    reason VARCHAR(100),
    attempted_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- WAVES (Gate Times)
-- =====================================================
CREATE TABLE waves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    year_group INT NOT NULL,  -- 4 = 4th years first
    gate_open TIMESTAMP NOT NULL,
    gate_close TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (gate_close > gate_open)
);

-- =====================================================
-- QR OUTPASS
-- =====================================================
CREATE TABLE outpasses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    purpose VARCHAR(200) NOT NULL,
    destination VARCHAR(200),
    out_time TIMESTAMP NOT NULL,
    expected_return TIMESTAMP NOT NULL,
    actual_return TIMESTAMP,
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    hmac_signature VARCHAR(128) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
    verified_by UUID REFERENCES students(id),  -- guard who verified
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- GRIEVANCE VAULT (AES-256 encrypted)
-- =====================================================
CREATE TABLE grievances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id),
    encrypted_content TEXT NOT NULL,  -- AES-256-GCM ciphertext
    iv VARCHAR(32) NOT NULL,          -- initialization vector
    auth_tag VARCHAR(32) NOT NULL,    -- GCM authentication tag
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- =====================================================
-- ELECTIONS (One-Vote System)
-- =====================================================
CREATE TABLE elections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    election_type VARCHAR(30) NOT NULL CHECK (election_type IN ('block_rep', 'mess_committee', 'cultural', 'sports', 'general')),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (end_time > start_time)
);

CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id),
    manifesto TEXT,
    UNIQUE (election_id, student_id)
);

CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    election_id UUID NOT NULL REFERENCES elections(id),
    voter_id UUID NOT NULL REFERENCES students(id),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    voted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (election_id, voter_id)  -- ONE vote per student per election
);

-- =====================================================
-- INFRASTRUCTURE HEALTH
-- =====================================================
CREATE TABLE infra_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostel_id UUID NOT NULL REFERENCES hostels(id),
    wifi_strength INT CHECK (wifi_strength BETWEEN 0 AND 100),
    power_status VARCHAR(10) DEFAULT 'on' CHECK (power_status IN ('on', 'off', 'backup')),
    water_status VARCHAR(10) DEFAULT 'on' CHECK (water_status IN ('on', 'off', 'low')),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- SHARED ASSETS (Inventory Ledger)
-- =====================================================
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostel_id UUID NOT NULL REFERENCES hostels(id),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('laundry', 'sports', 'electronics', 'furniture', 'other')),
    total_count INT NOT NULL DEFAULT 1,
    available_count INT NOT NULL DEFAULT 1,
    CHECK (available_count >= 0 AND available_count <= total_count)
);

CREATE TABLE asset_checkouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    student_id UUID NOT NULL REFERENCES students(id),
    checked_out_at TIMESTAMP DEFAULT NOW(),
    expected_return TIMESTAMP,
    actual_return TIMESTAMP,
    status VARCHAR(20) DEFAULT 'checked_out' CHECK (status IN ('checked_out', 'returned', 'overdue'))
);

-- =====================================================
-- ROOM SIGNALS (Live Heatmap 🔥)
-- =====================================================
CREATE TABLE room_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    student_id UUID NOT NULL REFERENCES students(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- OTPs (Email Verification)
-- =====================================================
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    purpose VARCHAR(20) DEFAULT 'registration' CHECK (purpose IN ('registration', 'password_reset')),
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT false,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- MEDIA PORTAL
-- =====================================================
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostel_id UUID REFERENCES hostels(id),
    uploaded_by UUID NOT NULL REFERENCES students(id),
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('photo', 'video')),
    url TEXT NOT NULL,
    caption VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ROOM INTEREST (Pre-Lottery Demand Tracking)
-- =====================================================
CREATE TABLE room_interest (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    year_group INT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, room_id)
);
