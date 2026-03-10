import { useState } from 'react';
import { AppState, PrepData, ReportData, InterviewSnapshot } from './types';
import InputScreen from './components/InputScreen';
import ResearchScreen from './components/ResearchScreen';
import PrepPackScreen from './components/PrepPackScreen';
import MockInterviewScreen from './components/MockInterviewScreen';
import AnalyzingScreen from './components/AnalyzingScreen';
import ReportScreen from './components/ReportScreen';

export default function App() {
  const [appState, setAppState] = useState<AppState>('INPUT');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | string | null>(null);
  const [prepData, setPrepData] = useState<PrepData | null>(null);
  const [interviewVideo, setInterviewVideo] = useState<Blob | null>(null);
  const [interviewTranscript, setInterviewTranscript] = useState<string>('');
  const [interviewSnapshots, setInterviewSnapshots] = useState<InterviewSnapshot[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const handleInputComplete = (resume: File, jd: File | string) => {
    setResumeFile(resume);
    setJdFile(jd);
    setAppState('RESEARCHING');
  };

  const handleResearchComplete = (data: PrepData) => {
    setPrepData(data);
    setAppState('PREP_PACK');
  };

  const handleStartInterview = () => {
    setAppState('MOCK_INTERVIEW');
  };

  const handleInterviewComplete = (video: Blob, transcript: string, snapshots: InterviewSnapshot[]) => {
    setInterviewVideo(video);
    setInterviewTranscript(transcript);
    setInterviewSnapshots(snapshots);
    setAppState('ANALYZING');
  };

  const handleAnalysisComplete = (data: ReportData) => {
    setReportData(data);
    setAppState('REPORT');
  };

  const handleRestart = () => {
    setAppState('INPUT');
    setResumeFile(null);
    setJdFile(null);
    setPrepData(null);
    setInterviewVideo(null);
    setInterviewTranscript('');
    setInterviewSnapshots([]);
    setReportData(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      {appState === 'INPUT' && (
        <InputScreen onComplete={handleInputComplete} />
      )}
      {appState === 'RESEARCHING' && resumeFile && jdFile && (
        <ResearchScreen 
          resume={resumeFile} 
          jd={jdFile} 
          onComplete={handleResearchComplete} 
        />
      )}
      {appState === 'PREP_PACK' && prepData && (
        <PrepPackScreen 
          data={prepData} 
          onStartInterview={handleStartInterview} 
        />
      )}
      {appState === 'MOCK_INTERVIEW' && prepData && (
        <MockInterviewScreen 
          prepData={prepData}
          onComplete={handleInterviewComplete} 
        />
      )}
      {appState === 'ANALYZING' && prepData && interviewVideo && (
        <AnalyzingScreen 
          prepData={prepData}
          video={interviewVideo}
          transcript={interviewTranscript}
          snapshots={interviewSnapshots}
          onComplete={handleAnalysisComplete} 
        />
      )}
      {appState === 'REPORT' && reportData && (
        <ReportScreen 
          data={reportData} 
          onRestart={handleRestart} 
        />
      )}
    </div>
  );
}
