export type AppState = 'INPUT' | 'RESEARCHING' | 'PREP_PACK' | 'MOCK_INTERVIEW' | 'ANALYZING' | 'REPORT';

export interface PrepData {
  companyName: string;
  roleTitle: string;
  companyInsights: string;
  fitMap: {
    alignmentScore: number;
    strengths: string[];
    gaps: string[];
    skillsAnalysis: { skill: string; score: number }[];
  };
  interviewPlan: string;
  sources: string[];
}

export interface ReportData {
  overallScore: number;
  metrics: {
    communication: number;
    technical: number;
    confidence: number;
  };
  goodExamples: { quote: string; reason: string }[];
  badExamples: { quote: string; reason: string; improvement: string }[];
  actionPlan: string;
  videoInsights?: string;
}

/**
 * A single webcam snapshot captured during the mock interview.
 * base64 is a JPEG encoded at ~50KB (480×360, quality 0.7).
 */
export interface InterviewSnapshot {
  base64: string;       // raw base64, no data: prefix
  timestamp: number;    // seconds elapsed since interview started
}
