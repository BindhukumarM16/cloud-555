export type AnalysisMode = 'live' | 'demo';

export type VerdictLevel = 'genuine' | 'suspicious' | 'fake';

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface BiometricSignals {
  faceDetectedInId: boolean;
  faceDetectedInSelfie: boolean;
  similarity: number; // 0 - 100
  sharpness: number; // 0 - 100
  brightness: number; // 0 - 100
  pose: HeadPose;
  livenessConfidence: number | null; // 0 - 100 when liveness evaluated
  livenessPassed: boolean | null;
  spoofIndicators: string[];
  observations: string[];
}

export interface RiskThresholds {
  genuineSimilarityMin: number; // default 90
  suspiciousSimilarityMin: number; // default 70
  sharpnessMin: number; // default 40
  brightnessMin: number; // default 30
  brightnessMax: number; // default 90
  maxAbsYaw: number; // default 25
  livenessConfidenceMin: number; // default 75
}

export interface ReasonItem {
  code: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface RiskEvaluation {
  verdict: VerdictLevel;
  verdictLabel: string;
  actionLabel: string;
  summary: string;
  reasons: ReasonItem[];
}

export interface VerificationResult {
  id: string;
  timestamp: string;
  mode: AnalysisMode;
  requireLiveness: boolean;
  signals: BiometricSignals;
  evaluation: RiskEvaluation;
  rawPayload: Record<string, unknown>;
}

export interface LivenessSessionInfo {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  challenges: string[];
  region: string;
}

export interface LivenessResult {
  sessionId: string;
  mode: AnalysisMode;
  status: 'SUCCEEDED' | 'FAILED';
  confidence: number;
  spoofIndicators: string[];
  observations: string[];
  linkedSimilarity: number | null;
  linkedEvaluation: RiskEvaluation | null;
  rawPayload: Record<string, unknown>;
}

export interface TestCaseScenario {
  id: 'genuine' | 'mismatch' | 'dark_blur' | 'no_face' | 'photo_replay';
  title: string;
  testCaseLabel: string;
  expectedVerdict: string;
  expectedLevel: VerdictLevel;
  notes: string;
  optionNote: string;
  simulatedSignals: BiometricSignals;
}
