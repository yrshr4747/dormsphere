/**
 * IIITDM Kurnool — Unified Identity Parser
 */

const ROLL_REGEX = /^([15])(2[1-6])(CS|EC|ME|AD)(\d{4})$/i;

const BRANCH_NAMES: Record<string, string> = {
  CS: 'CSE',
  EC: 'ECE',
  ME: 'Mechanical',
  AD: 'AI & DS',
};

const CURRENT_YEAR = 2026;
const ALLOWED_DOMAIN = '@iiitk.ac.in';
const SUPER_ADMIN_EMAIL = 'yashrajsingh4747@gmail.com';

export interface UserIdentity {
  role: 'student' | 'admin';
  designation: string;
  isVerified: boolean;
  degreePrefix?: number;
  degreeType?: 'B.Tech' | 'Dual Degree';
  batchYear?: number;
  branch?: string;
  branchName?: string;
  serial?: number;
  yearGroup?: number;
}

/**
 * Parse an email and optional roll number into unified institutional components.
 * 
 * @param email 
 * @param rollNumber 
 */
export function parseIdentity(email: string, rollNumber?: string): UserIdentity | null {
  // 1. Super-Admin Exception
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
    return {
      role: 'admin',
      designation: 'Chief Warden',
      isVerified: true, // Special flag to bypass OTP
    };
  }

  // 2. Institutional Domain Check
  if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
    return null;
  }

  const emailPrefix = email.split('@')[0];

  // 3. Roll Number Pattern Test
  const rollMatch = emailPrefix.match(ROLL_REGEX);

  if (rollMatch) {
    // Student Logic
    // If a rollNumber is explicitly provided, it MUST match the email prefix exactly.
    if (rollNumber && rollNumber.toUpperCase() !== emailPrefix.toUpperCase()) {
      return null;
    }

    const degreePrefix = parseInt(rollMatch[1], 10);
    const batchYearShort = parseInt(rollMatch[2], 10);
    const branch = rollMatch[3].toUpperCase();
    const serial = parseInt(rollMatch[4], 10);

    const batchYear = 2000 + batchYearShort;
    let yearGroup = CURRENT_YEAR - batchYear;
    if (yearGroup === 0) yearGroup = 1; // Incoming Freshers

    // AD (AI&DS) does not offer Dual Degree
    if (degreePrefix === 5 && branch === 'AD') return null;

    return {
      role: 'student',
      designation: 'Student',
      isVerified: false,
      degreePrefix,
      degreeType: degreePrefix === 1 ? 'B.Tech' : 'Dual Degree',
      batchYear,
      branch,
      branchName: BRANCH_NAMES[branch] || branch,
      serial,
      yearGroup,
    };
  }

  // 4. Staff / Admin Logic (Name-based email)
  return {
    role: 'admin',
    // The designation will be overridden by the registration payload in the controller
    designation: 'Staff',
    isVerified: false,
  };
}

export function isRollNumberFormat(str: string): boolean {
  return ROLL_REGEX.test(str);
}
