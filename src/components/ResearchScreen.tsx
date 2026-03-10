import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Search, Cpu, Target, CheckCircle2 } from 'lucide-react';
import { PrepData } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { fileToBase64 } from '../utils/file';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ResearchScreenProps {
  resume: File;
  jd: File | string;
  onComplete: (data: PrepData) => void;
}

const steps = [
  { id: 'extract', label: 'Extracting Role & Company', icon: Target },
  { id: 'research', label: 'Running Web Research', icon: Search },
  { id: 'fit', label: 'Building Fit Map', icon: Cpu },
  { id: 'plan', label: 'Generating Interview Plan', icon: CheckCircle2 },
];

export default function ResearchScreen({ resume, jd, onComplete }: ResearchScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runResearch = async () => {
      try {
        const resumeBase64 = await fileToBase64(resume);
        let jdPart: any;
        
        if (typeof jd === 'string') {
          jdPart = { text: jd };
        } else {
          const jdBase64 = await fileToBase64(jd);
          jdPart = {
            inlineData: {
              data: jdBase64,
              mimeType: jd.type || 'application/pdf',
            },
          };
        }

        setCurrentStep(1); // Researching

        const promptAnalysis = `
          I am providing a candidate's resume and a job description (the resume is a PDF, the job description is either a PDF or text).
          1. Extract the target Company Name and Role Title from the Job Description.
          2. Compare the candidate's resume to the job description to build a "Fit Map" (alignment score 0-100, top 3 strengths, top 3 gaps).
          3. Evaluate 5 key skills required for the role and score the candidate out of 100 for each.
          4. Generate a tailored interview plan for tomorrow.

          Return the result as a JSON object matching this schema:
          {
            "companyName": "string",
            "roleTitle": "string",
            "fitMap": {
              "alignmentScore": number,
              "strengths": ["string"],
              "gaps": ["string"],
              "skillsAnalysis": [
                { "skill": "string", "score": number }
              ]
            },
            "interviewPlan": "string (markdown)"
          }
        `;

        const promptResearch = `
          I am providing a job description. Extract the target Company Name.
          Use Google Search to research the company's recent news, culture, and interview style.

          Return the result as a JSON object matching this schema:
          {
            "companyInsights": "string (markdown)"
          }
        `;

        // Run analysis and web research in parallel to optimize time
        const analysisPromise = ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              {
                inlineData: {
                  data: resumeBase64,
                  mimeType: resume.type || 'application/pdf',
                },
              },
              jdPart,
              { text: promptAnalysis },
            ],
          },
          config: {
            temperature: 0.2,
          },
        });

        const researchPromise = ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              jdPart,
              { text: promptResearch },
            ],
          },
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
          },
        });

        // Simulate progress steps for better UX
        let simulatedStep = 1;
        const progressInterval = setInterval(() => {
          simulatedStep++;
          if (simulatedStep < 4) {
            setCurrentStep(simulatedStep);
          }
        }, 4000);

        const [analysisResponse, researchResponse] = await Promise.all([analysisPromise, researchPromise]);
        
        clearInterval(progressInterval);
        setCurrentStep(3); // Plan
        
        const textAnalysis = analysisResponse.text;
        const textResearch = researchResponse.text;
        
        if (!textAnalysis || !textResearch) throw new Error('No response from AI');
        
        let analysisData, researchData;
        try {
          const jsonStrA = textAnalysis.replace(/```json/gi, '').replace(/```/g, '').trim();
          analysisData = JSON.parse(jsonStrA);
          
          const jsonStrR = textResearch.replace(/```json/gi, '').replace(/```/g, '').trim();
          researchData = JSON.parse(jsonStrR);
        } catch (e) {
          console.error("Failed to parse JSON:", textAnalysis, textResearch);
          throw new Error("Failed to parse AI response into structured data.");
        }
        
        // Extract sources from grounding metadata
        const chunks = researchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = chunks
          .map((chunk: any) => chunk.web?.uri)
          .filter(Boolean) as string[];

        // Simulate a slight delay for UI feel
        setTimeout(() => {
          onComplete({
            ...analysisData,
            companyInsights: researchData.companyInsights || "No insights found.",
            sources: Array.from(new Set(sources)), // Unique sources
          });
        }, 1000);

      } catch (err: any) {
        console.error('Research error:', err);
        setError(err.message || 'Failed to complete research sequence.');
      }
    };

    runResearch();
  }, [resume, jd, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#050505] -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-sans font-medium tracking-tight text-white">
            Initializing Prep Sequence
          </h2>
          <p className="text-blue-400/80 font-mono text-xs uppercase tracking-widest">
            Establishing secure connection to intelligence network...
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
