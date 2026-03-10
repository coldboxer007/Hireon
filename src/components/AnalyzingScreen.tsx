import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Activity, FileText, Video, CheckCircle2 } from 'lucide-react';
import { PrepData, ReportData } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AnalyzingScreenProps {
  prepData: PrepData;
  video: Blob;
  transcript: string;
  onComplete: (data: ReportData) => void;
}

const steps = [
  { id: 'upload', label: 'Processing Video & Audio', icon: Video },
  { id: 'transcript', label: 'Analyzing Transcript', icon: FileText },
  { id: 'metrics', label: 'Calculating Metrics', icon: Activity },
  { id: 'report', label: 'Generating Final Report', icon: CheckCircle2 },
];

export default function AnalyzingScreen({ prepData, video, transcript, onComplete }: AnalyzingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runAnalysis = async () => {
      try {
        setCurrentStep(1); // Transcript

        // Convert video blob to base64
        let videoBase64 = '';
        const MAX_INLINE_SIZE = 15 * 1024 * 1024; // 15MB
        
        if (video.size <= MAX_INLINE_SIZE) {
          videoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(video);
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
              } else {
                reject(new Error('Failed to convert video'));
              }
            };
            reader.onerror = reject;
          });
        } else {
          console.warn("Video too large for inline data, falling back to transcript analysis only.");
        }

        setCurrentStep(2); // Metrics

        const prompt = `
          I am providing a recorded mock interview video and its transcript (if available).
          The candidate is interviewing for ${prepData.roleTitle} at ${prepData.companyName}.
          Transcript:
          ${transcript || 'No transcript available. Rely on video/audio.'}

          Analyze the performance and generate a final report.
          Include:
          1. Overall Score (0-100)
          2. Metrics (Communication, Technical, Confidence) (0-100)
          3. Good Examples (quotes and reasons)
          4. Bad Examples (quotes, reasons, and improvements)
          5. Action Plan (Tonight's Crash Plan)
          6. Video Insights (body language, eye contact, tone) - If no video is provided, infer from transcript or state "Video analysis skipped due to size limits".

          Return the result as a JSON object matching this schema:
          {
            "overallScore": number,
            "metrics": {
              "communication": number,
              "technical": number,
              "confidence": number
            },
            "goodExamples": [{ "quote": "string", "reason": "string" }],
            "badExamples": [{ "quote": "string", "reason": "string", "improvement": "string" }],
            "actionPlan": "string (markdown)",
            "videoInsights": "string (markdown)"
          }
        `;

        const parts: any[] = [{ text: prompt }];
        if (videoBase64) {
          parts.unshift({
            inlineData: {
              data: videoBase64,
              mimeType: video.type || 'video/webm',
            },
          });
        }

        // Simulate progress steps for better UX
        let simulatedStep = 1;
        const progressInterval = setInterval(() => {
          simulatedStep++;
          if (simulatedStep < 4) {
            setCurrentStep(simulatedStep);
          }
        }, 5000);

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: { parts },
          config: {
            temperature: 0.2,
          },
        });

        clearInterval(progressInterval);
        setCurrentStep(3); // Report
        
        const text = response.text;
        if (!text) throw new Error('No response from AI');
        
        let data;
        try {
          const jsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          data = JSON.parse(jsonStr);
        } catch (e) {
          console.error("Failed to parse JSON:", text);
          throw new Error("Failed to parse AI response into structured data.");
        }
        
        setTimeout(() => {
          onComplete(data);
        }, 1500);

      } catch (err: any) {
        console.error('Analysis error:', err);
        setError(err.message || 'Failed to analyze interview.');
      }
    };

    runAnalysis();
  }, [prepData, video, transcript, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#050505] -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-sans font-medium tracking-tight text-white">
            Analyzing Performance
          </h2>
          <p className="text-blue-400/80 font-mono text-xs uppercase tracking-widest">
            Processing telemetry and behavioral data...
          </p>
        </div>

        {error ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center font-mono text-sm backdrop-blur-sm shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isPast = index < currentStep;
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-5 rounded-2xl border transition-all duration-500 backdrop-blur-sm ${
                    isActive
                      ? 'bg-zinc-900/80 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                      : isPast
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : 'bg-zinc-900/30 border-zinc-800/50 text-zinc-600'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500 ${
                    isActive ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : isPast ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800/50'
                  }`}>
                    {isActive ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium tracking-wide ${isActive ? 'text-white' : isPast ? 'text-blue-400' : 'text-zinc-500'}`}>
                      {step.label}
                    </p>
                    {isActive && (
                      <div className="h-1.5 w-full bg-zinc-800/50 rounded-full mt-3 overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    )}
                  </div>
                  {isPast && (
                    <CheckCircle2 className="w-6 h-6 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
