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
