/**
 * Personality Vectorizer
 * Converts raw survey answers into numerical 3D lifestyle vectors (Sleep, Study, Social).
 */

interface SurveyAnswers {
  // Sleep-related
  bedtime: string;       // 'before-10pm' | '10pm-12am' | '12am-2am' | 'after-2am'
  wakeTime: string;      // 'before-7am' | '7am-9am' | '9am-11am' | 'after-11am'
  lightSleeper: boolean;
  
  // Study-related
  studyHours: string;    // '0-2' | '2-4' | '4-6' | '6+'
  studyLocation: string; // 'room' | 'library' | 'mix'
  noiseWhileStudy: string; // 'silence' | 'music' | 'doesnt-matter'
  
  // Social-related
  guestsFrequency: string; // 'rarely' | 'sometimes' | 'often' | 'daily'
  partyPerson: boolean;
  introExtro: number;    // 1-5 scale (1 = introvert, 5 = extrovert)
}

interface LifestyleVector {
  sleep: number;  // 0-10
  study: number;  // 0-10
  social: number; // 0-10
}

// Mapping tables
const BEDTIME_MAP: Record<string, number> = {
  'before-10pm': 9,
  '10pm-12am': 7,
  '12am-2am': 4,
  'after-2am': 2,
};

const WAKE_MAP: Record<string, number> = {
  'before-7am': 9,
  '7am-9am': 7,
  '9am-11am': 4,
  'after-11am': 2,
};

const STUDY_HOURS_MAP: Record<string, number> = {
  '0-2': 2,
  '2-4': 5,
  '4-6': 7,
  '6+': 9,
};

const STUDY_LOC_MAP: Record<string, number> = {
  'room': 8,
  'library': 4,
  'mix': 6,
};

const NOISE_MAP: Record<string, number> = {
  'silence': 9,
  'music': 5,
  'doesnt-matter': 3,
};

const GUESTS_MAP: Record<string, number> = {
  'rarely': 2,
  'sometimes': 4,
  'often': 7,
  'daily': 9,
};

export function vectorizeSurvey(answers: SurveyAnswers): LifestyleVector {
  // Sleep score: weighted average of bedtime, wake time, and light-sleeper
  const bedtimeScore = BEDTIME_MAP[answers.bedtime] || 5;
  const wakeScore = WAKE_MAP[answers.wakeTime] || 5;
  const lightSleeperBonus = answers.lightSleeper ? 2 : 0;
  const sleep = Math.min(10, (bedtimeScore * 0.4 + wakeScore * 0.4 + lightSleeperBonus * 0.2) * 1.1);

  // Study score: weighted average of hours, location preference, noise tolerance
  const hoursScore = STUDY_HOURS_MAP[answers.studyHours] || 5;
  const locScore = STUDY_LOC_MAP[answers.studyLocation] || 5;
  const noiseScore = NOISE_MAP[answers.noiseWhileStudy] || 5;
  const study = Math.min(10, (hoursScore * 0.5 + locScore * 0.25 + noiseScore * 0.25));

  // Social score: weighted average of guests, party, intro/extro
  const guestsScore = GUESTS_MAP[answers.guestsFrequency] || 5;
  const partyScore = answers.partyPerson ? 8 : 3;
  const introExtroScore = (answers.introExtro / 5) * 10;
  const social = Math.min(10, (guestsScore * 0.35 + partyScore * 0.25 + introExtroScore * 0.4));

  return {
    sleep: Math.round(sleep * 10) / 10,
    study: Math.round(study * 10) / 10,
    social: Math.round(social * 10) / 10,
  };
}

// Calculate compatibility between two vectors (cosine similarity mapped to 0-100)
export function calculateCompatibility(v1: LifestyleVector, v2: LifestyleVector): number {
  const dot = v1.sleep * v2.sleep + v1.study * v2.study + v1.social * v2.social;
  const mag1 = Math.sqrt(v1.sleep ** 2 + v1.study ** 2 + v1.social ** 2);
  const mag2 = Math.sqrt(v2.sleep ** 2 + v2.study ** 2 + v2.social ** 2);
  
  if (mag1 < 1e-9 || mag2 < 1e-9) return 0;
  
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((cosTheta + 1) * 50 * 10) / 10; // 0-100 with 1 decimal
}
