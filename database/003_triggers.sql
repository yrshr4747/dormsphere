-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Enforce year_group parity for roommate pairings
CREATE OR REPLACE FUNCTION check_same_year_group()
RETURNS TRIGGER AS $$
DECLARE
    inviter_yg INT;
    invitee_yg INT;
BEGIN
    SELECT year_group INTO inviter_yg FROM students WHERE id = NEW.inviter_id;
    SELECT year_group INTO invitee_yg FROM students WHERE id = NEW.invitee_id;
    
    IF inviter_yg IS DISTINCT FROM invitee_yg THEN
        RAISE EXCEPTION 'Roommates must belong to the same year group.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_same_year_group ON roommate_pairings;

CREATE TRIGGER trg_check_same_year_group
BEFORE INSERT OR UPDATE ON roommate_pairings
FOR EACH ROW
EXECUTE FUNCTION check_same_year_group();
