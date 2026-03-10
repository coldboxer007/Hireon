import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Search, Cpu, Target, CheckCircle2, Zap } from 'lucide-react';
import { PrepData } from '../types';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { fileToBase64 } from '../utils/file';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface ResearchScreenProps {
  resume: File;
  jd: File | string;
  onComplete: (data: PrepData) => void;
}

const steps = [
  { id: 'extract', label: 'Extracting Role & Company', sub: 'Parsing documents…', icon: Target, color: 'blue' },
  { id: 'research', label: 'Running AI Research', sub: 'Querying Nova 2 Lite…', icon: Search, color: 'violet' },
  { id: 'fit', label: 'Building Fit Map', sub: 'Scoring alignment…', icon: Cpu, color: 'cyan' },
  { id: 'plan', label: 'Generating Interview Plan', sub: 'Crafting strategy…', icon: Zap, color: 'emerald' },
];

const colorMap: Record<string, { ring: string; glow: string; icon: string; bar: string; check: string }> = {
  blue: { ring: 'border-blue-500/60', glow: 'shadow-[0_0_30px_rgba(59,130,246,0.2)]', icon: 'bg-blue-500 text-white', bar: 'bg-blue-500', check: 'text-blue-400' },
  violet: { ring: 'border-violet-500/60', glow: 'shadow-[0_0_30px_rgba(139,92,246,0.2)]', icon: 'bg-violet-500 text-white', bar: 'bg-violet-500', check: 'text-violet-400' },
  cyan: { ring: 'border-cyan-500/60', glow: 'shadow-[0_0_30px_rgba(6,182,212,0.2)]', icon: 'bg-cyan-500 text-white', bar: 'bg-cyan-500', check: 'text-cyan-400' },
  emerald: { ring: 'border-emerald-500/60', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.2)]', icon: 'bg-emerald-500 text-white', bar: 'bg-emerald-500', check: 'text-emerald-400' },
};

export default function ResearchScreen({ resume, jd, onComplete }: ResearchScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runResearch = async () => {
      try {
        const resumeBase64 = await fileToBase64(resume);
        setCurrentStep(1);

        const promptAnalysis = `
          I am providing a candidate's resume and a job description.
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
              "skillsAnalysis": [{ "skill": "string", "score": number }]
            },
            "interviewPlan": "string (markdown)"
          }
        `;

        const promptResearch = `
          I am providing a job description. Extract the target Company Name.
          Research the company's recent news, culture, and interview style based on your knowledge.
          Return the result as a JSON object: { "companyInsights": "string (markdown)" }
        `;

        const analysisContent: any[] = [
          { document: { format: 'pdf', name: 'resume', source: { bytes: Uint8Array.from(atob(resumeBase64), c => c.charCodeAt(0)) } } },
        ];
        if (typeof jd === 'string') {
          analysisContent.push({ text: `Job Description:\n${jd}` });
        } else {
          const jdBase64 = await fileToBase64(jd);
          analysisContent.push({ document: { format: 'pdf', name: 'job-description', source: { bytes: Uint8Array.from(atob(jdBase64), c => c.charCodeAt(0)) } } });
        }
        analysisContent.push({ text: promptAnalysis });

        const researchContent: any[] = [];
        if (typeof jd === 'string') {
          researchContent.push({ text: `Job Description:\n${jd}` });
        } else {
          const jdBase64 = await fileToBase64(jd);
          researchContent.push({ document: { format: 'pdf', name: 'job-description', source: { bytes: Uint8Array.from(atob(jdBase64), c => c.charCodeAt(0)) } } });
        }
        researchContent.push({ text: promptResearch });

        const analysisPromise = bedrockClient.send(new ConverseCommand({
          modelId: 'us.amazon.nova-2-lite-v1:0',
          system: [{ text: 'You are an expert career coach and interview strategist. Always return valid JSON.' }],
          messages: [{ role: 'user', content: analysisContent }],
          inferenceConfig: { temperature: 0.2, maxTokens: 4096 },
        }));

        const researchPromise = bedrockClient.send(new ConverseCommand({
          modelId: 'us.amazon.nova-2-lite-v1:0',
          system: [{ text: 'You are an expert career coach and interview strategist. Always return valid JSON.' }],
          messages: [{ role: 'user', content: researchContent }],
          inferenceConfig: { temperature: 0.2, maxTokens: 4096 },
        }));

        let simulatedStep = 1;
        const progressInterval = setInterval(() => {
          simulatedStep++;
          if (simulatedStep < 4) setCurrentStep(simulatedStep);
        }, 4000);

        const [analysisResponse, researchResponse] = await Promise.all([analysisPromise, researchPromise]);

        clearInterval(progressInterval);
        setCurrentStep(3);

        const textAnalysis = analysisResponse.output?.message?.content?.[0]?.text;
        const textResearch = researchResponse.output?.message?.content?.[0]?.text;
        if (!textAnalysis || !textResearch) throw new Error('No response from AI');

        let analysisData, researchData;
        try {
          analysisData = JSON.parse(textAnalysis.replace(/```json/gi, '').replace(/```/g, '').trim());
          researchData = JSON.parse(textResearch.replace(/```json/gi, '').replace(/```/g, '').trim());
        } catch {
          throw new Error('Failed to parse AI response into structured data.');
        }

        setTimeout(() => {
          onComplete({ ...analysisData, companyInsights: researchData.companyInsights || 'No insights found.', sources: [] });
        }, 1000);

      } catch (err: any) {
        setError(err.message || 'Failed to complete research sequence.');
      }
    };

    runResearch();
  }, [resume, jd, onComplete]);

  return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-blue-950/40 blur-[140px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="research-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#research-dots)" />
        </svg>
      </div>

      <div className="w-full max-w-lg space-y-10 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/8 text-blue-400 text-[10px] font-mono uppercase tracking-widest">
            <Cpu className="w-3 h-3" />
            Hireeon · Nova 2 Lite
          </div>
          <h2 className="text-3xl font-light tracking-tight text-white">
            Analyzing Your Profile
          </h2>
          <p className="text-sm text-zinc-600 font-mono">Preparing your personalized prep pack…</p>
        </motion.div>

        {/* Steps */}
        {error ? (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-red-500/8 border border-red-500/20 text-center">
            <p className="text-sm font-mono text-red-400 font-medium mb-1">Analysis Failed</p>
            <p className="text-xs text-red-400/60 leading-relaxed">{error}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isPast = index < currentStep;
              const Icon = step.icon;
              const c = colorMap[step.color];

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.4 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500
                    ${isActive
                      ? `bg-zinc-900/70 ${c.ring} ${c.glow} backdrop-blur-sm`
                      : isPast
                      ? 'bg-zinc-900/30 border-zinc-800/60'
                      : 'bg-zinc-900/10 border-zinc-800/30'
                    }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                    isActive ? c.icon + ' shadow-lg' : isPast ? 'bg-zinc-800/60 text-zinc-400' : 'bg-zinc-900/40 text-zinc-700'
                  }`}>
                    {isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-4.5 h-4.5" />}
                  </div>

                  {/* Text + progress */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : isPast ? 'text-zinc-400' : 'text-zinc-700'}`}>
                      {step.label}
                    </p>
                    {isActive && (
                      <div className="mt-2 h-1 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${c.bar}`}
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    )}
                    {!isActive && (
                      <p className={`text-[11px] font-mono mt-0.5 ${isPast ? 'text-zinc-600' : 'text-zinc-800'}`}>
                        {isPast ? 'Complete' : step.sub}
                      </p>
                    )}
                  </div>

                  {/* Check */}
                  {isPast && <CheckCircle2 className={`w-5 h-5 shrink-0 ${c.check}`} />}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Step counter */}
        {!error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-center text-[11px] font-mono text-zinc-700">
            Step {Math.min(currentStep + 1, 4)} of 4
          </motion.p>
        )}
      </div>
    </div>
  );
}
