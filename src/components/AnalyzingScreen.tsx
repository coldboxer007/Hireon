import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, FileText, Camera, CheckCircle2, Brain } from 'lucide-react';
import { PrepData, ReportData, InterviewSnapshot } from '../types';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface AnalyzingScreenProps {
  prepData: PrepData;
  video: Blob;
  transcript: string;
  snapshots: InterviewSnapshot[];
  onComplete: (data: ReportData) => void;
}

const steps = [
  { id: 'frames', label: 'Processing Camera Snapshots', icon: Camera },
  { id: 'transcript', label: 'Analyzing Transcript', icon: FileText },
  { id: 'metrics', label: 'Deep Reasoning Analysis', icon: Brain },
  { id: 'report', label: 'Generating Final Report', icon: CheckCircle2 },
];

export default function AnalyzingScreen({ prepData, video, transcript, snapshots, onComplete }: AnalyzingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reasoningText, setReasoningText] = useState<string>('');
  const [framesUsed, setFramesUsed] = useState(0);

  useEffect(() => {
    const runAnalysis = async () => {
      try {
        setCurrentStep(1); // Frames / transcript

        // ── Select up to 8 evenly-spaced snapshots ────────────────────────
        // Nova 2 Lite supports up to 20 images per request; we use ≤8 to stay
        // well inside token limits while giving good temporal coverage.
        const MAX_FRAMES = 8;
        let selectedSnapshots: InterviewSnapshot[] = [];
        if (snapshots.length > 0) {
          if (snapshots.length <= MAX_FRAMES) {
            selectedSnapshots = snapshots;
          } else {
            // Evenly spaced indices
            for (let i = 0; i < MAX_FRAMES; i++) {
              const idx = Math.round(i * (snapshots.length - 1) / (MAX_FRAMES - 1));
              selectedSnapshots.push(snapshots[idx]);
            }
          }
          setFramesUsed(selectedSnapshots.length);
        }

        setCurrentStep(2); // Deep reasoning

        const hasFrames = selectedSnapshots.length > 0;

        const prompt = `You are analyzing a mock interview recording for the role of ${prepData.roleTitle} at ${prepData.companyName}.

${hasFrames
  ? `I have provided ${selectedSnapshots.length} webcam snapshots taken at regular intervals (timestamps: ${selectedSnapshots.map(s => `${s.timestamp}s`).join(', ')}) during the interview. Analyze body language, eye contact, posture, facial expressions, and overall presence from these frames.`
  : 'No camera frames were available; base visual analysis on the transcript only.'}

Transcript of the interview:
${transcript || 'No transcript available.'}

Generate a comprehensive performance report. Return ONLY a valid JSON object matching this exact schema, no markdown fences:
{
  "overallScore": <number 0-100>,
  "metrics": {
    "communication": <number 0-100>,
    "technical": <number 0-100>,
    "confidence": <number 0-100>
  },
  "goodExamples": [{ "quote": "<string>", "reason": "<string>" }],
  "badExamples": [{ "quote": "<string>", "reason": "<string>", "improvement": "<string>" }],
  "actionPlan": "<markdown string — tonight's crash plan>",
  "videoInsights": "<markdown string — body language, eye contact, posture observations from the ${hasFrames ? selectedSnapshots.length + ' camera frames' : 'transcript'}>"
}`;

        // ── Build content array: images first, then the prompt ────────────
        // Nova 2 Lite image format: { image: { format: 'jpeg', source: { bytes: Uint8Array } } }
        const content: any[] = [];

        for (const snap of selectedSnapshots) {
          const bytes = Uint8Array.from(atob(snap.base64), c => c.charCodeAt(0));
          content.push({
            image: {
              format: 'jpeg',
              source: { bytes },
            },
          });
        }
        content.push({ text: prompt });

        // Simulate progress ticks for UX
        let simulatedStep = 1;
        const progressInterval = setInterval(() => {
          simulatedStep++;
          if (simulatedStep < 4) setCurrentStep(simulatedStep);
        }, 6000);

        // ── Call Nova 2 Lite (reasoningConfig — no temperature/maxTokens) ──
        const response = await bedrockClient.send(new ConverseCommand({
          modelId: 'us.amazon.nova-2-lite-v1:0',
          system: [{ text: 'You are an expert interview performance analyst. Return only valid JSON with no markdown fences.' }],
          messages: [{ role: 'user', content }],
          additionalModelRequestFields: {
            reasoningConfig: {
              type: 'enabled',
              maxReasoningEffort: 'high',
            },
          },
        }));

        clearInterval(progressInterval);
        setCurrentStep(3);

        // ── Parse response ─────────────────────────────────────────────────
        let outputText = '';
        const contentBlocks = response.output?.message?.content || [];
        for (const block of contentBlocks) {
          if ('reasoningContent' in block) {
            const reasoning = (block as any).reasoningContent?.reasoningText?.text;
            if (reasoning) setReasoningText(reasoning);
          } else if ('text' in block) {
            outputText = (block as any).text || '';
          }
        }

        if (!outputText) throw new Error('No response from AI');

        let data: ReportData;
        try {
          const jsonStr = outputText.replace(/```json/gi, '').replace(/```/g, '').trim();
          data = JSON.parse(jsonStr);
        } catch (e) {
          console.error('Failed to parse JSON:', outputText);
          throw new Error('Failed to parse AI response into structured data.');
        }

        setTimeout(() => onComplete(data), 1500);

      } catch (err: any) {
        console.error('Analysis error:', err);
        setError(err.message || 'Failed to analyze interview.');
      }
    };

    runAnalysis();
  }, [prepData, video, transcript, snapshots, onComplete]);

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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 font-semibold normal-case tracking-tight text-sm">Hireeon</span>
            {' · '}Nova 2 Lite · Extended Thinking
          </p>
          {framesUsed > 0 && (
            <p className="text-zinc-500 font-mono text-xs">
              Analyzing {framesUsed} camera frame{framesUsed !== 1 ? 's' : ''} + transcript
            </p>
          )}
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
            
            {/* Extended Thinking Indicator */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
                  <span className="text-sm text-purple-300 font-mono">Deep reasoning active for nuanced feedback...</span>
                </div>
                {reasoningText && (
                  <p className="mt-2 text-xs text-purple-400/70 font-mono line-clamp-3">
                    {reasoningText.substring(0, 150)}...
                  </p>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
