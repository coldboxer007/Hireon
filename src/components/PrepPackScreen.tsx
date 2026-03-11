import { useState } from 'react';
import { motion } from 'motion/react';
import { PrepData, InterviewMode } from '../types';
import { ArrowRight, Target, Zap, AlertTriangle, BookOpen, Activity, Cpu, TrendingUp, Shield, Brain, Flame } from 'lucide-react';
import Markdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface PrepPackScreenProps {
  data: PrepData;
  onStartInterview: (mode: InterviewMode) => void;
}

export default function PrepPackScreen({ data, onStartInterview }: PrepPackScreenProps) {
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('standard');
  const hasSkills = data.fitMap?.skillsAnalysis && data.fitMap.skillsAnalysis.length > 0;
  const score = data.fitMap.alignmentScore;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const barColor = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-[#070710] relative overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-950/20 to-transparent" />
        <div className="absolute top-1/3 right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-950/30 blur-[120px]" />
        <div className="absolute bottom-1/4 left-[-5%] w-[400px] h-[400px] rounded-full bg-blue-950/20 blur-[100px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="prep-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#prep-dots)" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 lg:px-12 lg:py-14 space-y-10">

        {/* Model badge row */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2">
          <img src="/logo.png" alt="Hireon" className="w-6 h-6 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">Hireon</span>
          <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">powered by</span>
          {[
            { label: 'Nova 2 Lite · Research', icon: Cpu, color: 'blue' },
            { label: 'Nova 2 Sonic · Interview', icon: Activity, color: 'violet' },
            { label: 'Nova 2 Lite · Thinking', icon: Zap, color: 'emerald' },
          ].map((m) => (
            <span key={m.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-mono
              ${m.color === 'blue' ? 'border-blue-500/20 bg-blue-500/8 text-blue-400'
              : m.color === 'violet' ? 'border-violet-500/20 bg-violet-500/8 text-violet-400'
              : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400'}`}>
              <m.icon className="w-3 h-3" />
              {m.label}
            </span>
          ))}
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-800/50">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/25 bg-blue-500/8 text-blue-400 text-[10px] font-mono uppercase tracking-widest">
              <Target className="w-3 h-3" />
              Target Locked
            </div>
            <h1 className="text-4xl lg:text-6xl font-light tracking-[-0.025em] text-white leading-[1.08]">
              {data.roleTitle}
            </h1>
            <p className="text-xl text-zinc-500 font-light">
              at <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400 font-medium">{data.companyName}</span>
            </p>
          </div>

          <button onClick={() => onStartInterview(interviewMode)}
            className="group flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-medium text-base transition-all duration-300 hover:bg-zinc-100 hover:scale-[1.03] shadow-[0_0_50px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.18)] shrink-0 self-start md:self-auto">
            Enter Mock Interview
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-12 gap-6">

          {/* Left column */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
            className="lg:col-span-4 space-y-5">

            {/* Score card */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/8 blur-[50px]" />
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] mb-4">Alignment Score</p>
              <div className="flex items-baseline gap-2 mb-5">
                <span className={`text-6xl font-light tracking-[-0.04em] ${scoreColor}`}>{score}</span>
                <span className="text-lg text-zinc-600 font-mono">/100</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 1.4, delay: 0.4, ease: 'easeOut' }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
              <p className="text-[10px] font-mono text-zinc-700 mt-2">
                {score >= 80 ? 'Strong match — well positioned' : score >= 60 ? 'Decent fit — prep the gaps' : 'Moderate fit — focused prep needed'}
              </p>
            </div>

            {/* Radar */}
            {hasSkills && (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/3 blur-[60px] rounded-full" />
                <p className="flex items-center gap-2 text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-5 relative z-10">
                  <Activity className="w-3 h-3" /> Skills Analysis
                </p>
                <div className="h-64 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="68%" data={data.fitMap.skillsAnalysis}>
                      <PolarGrid stroke="#27272a" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#71717a', fontSize: 9, fontFamily: 'monospace' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#27272a', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }} itemStyle={{ color: '#60a5fa' }} />
                      <Radar name="Score" dataKey="score" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.15} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Strengths */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-6">
              <p className="flex items-center gap-2 text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-4">
                <Zap className="w-3 h-3" /> Key Strengths
              </p>
              <ul className="space-y-3">
                {data.fitMap?.strengths?.map((s, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }}
                    className="flex gap-3 text-zinc-300 text-sm leading-relaxed">
                    <div className="w-1 h-1 rounded-full bg-blue-400 mt-2 shrink-0" />
                    {s}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Gaps */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-6">
              <p className="flex items-center gap-2 text-[10px] font-mono text-amber-400 uppercase tracking-[0.2em] mb-4">
                <AlertTriangle className="w-3 h-3" /> Potential Gaps
              </p>
              <ul className="space-y-3">
                {data.fitMap?.gaps?.map((g, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                    className="flex gap-3 text-zinc-300 text-sm leading-relaxed">
                    <div className="w-1 h-1 rounded-full bg-amber-400 mt-2 shrink-0" />
                    {g}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Right column */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }}
            className="lg:col-span-8 space-y-5">

            {/* Resume Risk Detector */}
            {data.resumeRisks && data.resumeRisks.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] backdrop-blur-sm p-7 lg:p-9 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-60 h-60 bg-red-500/5 blur-[80px] rounded-full" />
                <p className="flex items-center gap-2 text-[10px] font-mono text-red-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                  <Shield className="w-3 h-3" /> Resume Risk Detector
                </p>
                <p className="text-xs text-zinc-500 mb-5 relative z-10">Things interviewers might challenge — with your defense strategies.</p>
                <ul className="space-y-4 relative z-10">
                  {data.resumeRisks.map((r, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                      className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <span className={`shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider
                          ${r.severity === 'high' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : r.severity === 'medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'}`}>
                          {r.severity}
                        </span>
                        <span className="text-sm text-zinc-200">{r.risk}</span>
                      </div>
                      <div className="flex items-start gap-2 ml-0.5 pl-4 border-l-2 border-emerald-500/30">
                        <span className="text-xs text-emerald-400 font-mono shrink-0">Defense →</span>
                        <span className="text-xs text-zinc-400 leading-relaxed">{r.defense}</span>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interviewer Brain — Predicted Questions */}
            {data.interviewerQuestions && data.interviewerQuestions.length > 0 && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] backdrop-blur-sm p-7 lg:p-9 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-60 h-60 bg-violet-500/5 blur-[80px] rounded-full" />
                <p className="flex items-center gap-2 text-[10px] font-mono text-violet-400 uppercase tracking-[0.2em] mb-2 relative z-10">
                  <Brain className="w-3 h-3" /> Interviewer Brain
                </p>
                <p className="text-xs text-zinc-500 mb-5 relative z-10">Predicted questions based on {data.companyName}'s culture, this JD, and your profile.</p>
                <ol className="space-y-3 relative z-10">
                  {data.interviewerQuestions.map((q, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                      className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-[10px] font-mono flex items-center justify-center mt-0.5">{i + 1}</span>
                      {q}
                    </motion.li>
                  ))}
                </ol>
              </div>
            )}

            {/* Interview Plan */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-7 lg:p-9 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-60 h-60 bg-blue-500/4 blur-[80px] rounded-full" />
              <p className="flex items-center gap-2 text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-6 relative z-10">
                <BookOpen className="w-3 h-3" /> Interview Plan
              </p>
              <div className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:font-medium prose-headings:tracking-tight prose-a:text-blue-400 prose-li:text-zinc-300 prose-p:text-zinc-400 relative z-10 prose-sm lg:prose-base">
                <Markdown>{data.interviewPlan}</Markdown>
              </div>
            </div>

            {/* Company Intelligence */}
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-7 lg:p-9">
              <p className="flex items-center gap-2 text-[10px] font-mono text-violet-400 uppercase tracking-[0.2em] mb-6">
                <TrendingUp className="w-3 h-3" /> Company Intelligence
              </p>
              <div className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:font-medium prose-headings:tracking-tight prose-li:text-zinc-300 prose-p:text-zinc-400 prose-sm lg:prose-base">
                <Markdown>{data.companyInsights}</Markdown>
              </div>
            </div>

            {/* Interview Mode Selector + CTA */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="rounded-2xl border border-zinc-800/40 bg-gradient-to-r from-zinc-900/60 to-zinc-900/30 p-6 space-y-5">

              {/* Mode toggle */}
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-3">Interview Mode</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setInterviewMode('standard')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-300
                      ${interviewMode === 'standard'
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                      }`}
                  >
                    <Activity className="w-4 h-4" />
                    Standard
                  </button>
                  <button
                    onClick={() => setInterviewMode('pressure')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-300
                      ${interviewMode === 'pressure'
                        ? 'border-red-500/50 bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                        : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                      }`}
                  >
                    <Flame className="w-4 h-4" />
                    Pressure 🔥
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-2">
                  {interviewMode === 'standard'
                    ? 'Realistic interview — balanced pace, constructive feedback'
                    : '⚠ Aggressive interviewer — pushback, follow-ups, stress-testing your answers'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Ready for the mock interview?</p>
                  <p className="text-xs text-zinc-600 font-mono mt-0.5">Nova 2 Sonic will conduct a live speech-to-speech session</p>
                </div>
                <button onClick={() => onStartInterview(interviewMode)}
                  className={`group flex items-center gap-2.5 px-7 py-3.5 rounded-full font-medium text-sm transition-all duration-300 hover:scale-[1.03] shrink-0
                    ${interviewMode === 'pressure'
                      ? 'bg-red-500 text-white hover:bg-red-400 shadow-[0_0_40px_rgba(239,68,68,0.2)]'
                      : 'bg-white text-black hover:bg-zinc-100 shadow-[0_0_40px_rgba(255,255,255,0.1)]'
                    }`}>
                  {interviewMode === 'pressure' ? '🔥 Start Pressure Interview' : 'Start Interview'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
