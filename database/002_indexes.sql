-- DormSphere Performance Indexes

-- Room selection hot path
CREATE INDEX idx_rooms_hostel_available ON rooms(hostel_id, is_available) WHERE is_available = true;
CREATE INDEX idx_rooms_floor ON rooms(hostel_id, floor);
CREATE INDEX idx_room_assignments_room ON room_assignments(room_id);
CREATE INDEX idx_room_assignments_student ON room_assignments(student_id);
CREATE INDEX idx_selection_attempts_room_status ON selection_attempts(room_id, status);
CREATE INDEX idx_selection_attempts_student ON selection_attempts(student_id);

-- Lottery
CREATE INDEX idx_lottery_ranks_rank ON lottery_ranks(rank);
CREATE INDEX idx_lottery_ranks_student ON lottery_ranks(student_id);

-- Matching
CREATE INDEX idx_matches_student_a ON matches(student_a);
CREATE INDEX idx_matches_student_b ON matches(student_b);
CREATE INDEX idx_vectors_student ON vectors(student_id);

-- Waves
CREATE INDEX idx_waves_active ON waves(is_active) WHERE is_active = true;
CREATE INDEX idx_waves_year_group ON waves(year_group);

-- Outpass
CREATE INDEX idx_outpasses_student ON outpasses(student_id);
CREATE INDEX idx_outpasses_status ON outpasses(status) WHERE status = 'active';
CREATE INDEX idx_outpasses_token ON outpasses(qr_token);

-- Elections
CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_candidates_election ON candidates(election_id);

-- Infrastructure
CREATE INDEX idx_infra_hostel ON infra_status(hostel_id);

-- Assets
CREATE INDEX idx_assets_hostel ON assets(hostel_id);
CREATE INDEX idx_asset_checkouts_status ON asset_checkouts(status) WHERE status = 'checked_out';

-- Room signals (heatmap)
CREATE INDEX idx_room_signals_room ON room_signals(room_id);
CREATE INDEX idx_room_signals_student ON room_signals(student_id);

-- OTPs
CREATE INDEX idx_otps_email_purpose ON otps(email, purpose);
CREATE INDEX idx_otps_expires ON otps(expires_at);
