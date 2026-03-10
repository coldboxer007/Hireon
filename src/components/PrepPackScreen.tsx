import { motion } from 'motion/react';
import { PrepData } from '../types';
import { ArrowRight, Target, Zap, AlertTriangle, BookOpen, ExternalLink, Activity } from 'lucide-react';
import Markdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface PrepPackScreenProps {
  data: PrepData;
  onStartInterview: () => void;
}

export default function PrepPackScreen({ data, onStartInterview }: PrepPackScreenProps) {
  // Ensure we have skills data to show
  const hasSkills = data.fitMap?.skillsAnalysis && data.fitMap.skillsAnalysis.length > 0;

  return (
    <div className="min-h-screen p-6 lg:p-12 relative overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[#050505] -z-10">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent" />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-800/50"
        >
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-widest mb-2 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Target className="w-4 h-4" />
              <span>Target Locked</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-sans font-medium tracking-tight text-white">
              {data.roleTitle}
            </h1>
            <p className="text-xl text-zinc-400 font-light">
              at <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-medium">{data.companyName}</span>
            </p>
          </div>

          <button
            onClick={onStartInterview}
            className="group relative flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-medium text-lg transition-all duration-500 hover:bg-zinc-200 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            Enter Mock Interview
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 rounded-full border border-white/20 animate-ping" style={{ animationDuration: '3s' }} />
          </button>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Fit Map & Radar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 space-y-8"
          >
            {/* Alignment Score */}
            <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full" />
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-6">Alignment Score</h3>
              <div className="flex items-end gap-4">
                <div className="text-7xl font-light tracking-tighter text-white">
                  {data.fitMap.alignmentScore}
                </div>
                <div className="text-xl text-zinc-500 mb-2 font-mono">/ 100</div>
              </div>
              <div className="mt-8 h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${data.fitMap.alignmentScore}%` }}
                  transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                  className={`h-full shadow-[0_0_10px_currentColor] ${data.fitMap.alignmentScore >= 80 ? 'bg-blue-400 text-blue-400' : data.fitMap.alignmentScore >= 60 ? 'bg-amber-400 text-amber-400' : 'bg-red-400 text-red-400'}`}
                />
              </div>
            </div>

            {/* Radar Chart (Skills Analysis) */}
            {hasSkills && (
              <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/5 blur-[50px] rounded-full" />
                <h3 className="flex items-center gap-2 text-xs font-mono text-blue-400 uppercase tracking-widest mb-6 relative z-10">
                  <Activity className="w-4 h-4" />
                  Skills Analysis
                </h3>
                <div className="h-[280px] w-full relative z-10 -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.fitMap.skillsAnalysis}>
                      <PolarGrid stroke="#27272a" />
                      <PolarAngleAxis 
                        dataKey="skill" 
                        tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }} 
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace' }}
                        itemStyle={{ color: '#60a5fa' }}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="#3b82f6"
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Strengths */}
            <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm">
              <h3 className="flex items-center gap-2 text-xs font-mono text-blue-400 uppercase tracking-widest mb-6">
                <Zap className="w-4 h-4" />
                Key Strengths
              </h3>
              <ul className="space-y-4">
                {data.fitMap?.strengths?.map((strength, i) => (
                  <li key={i} className="flex gap-4 text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                    <span className="leading-relaxed text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Gaps */}
            <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm">
              <h3 className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-6">
                <AlertTriangle className="w-4 h-4" />
                Potential Gaps
              </h3>
              <ul className="space-y-4">
                {data.fitMap?.gaps?.map((gap, i) => (
                  <li key={i} className="flex gap-4 text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                    <span className="leading-relaxed text-sm">{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Right Column: Insights & Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8 space-y-8"
          >
            {/* Interview Plan */}
            <div className="p-8 lg:p-10 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
              <h3 className="flex items-center gap-2 text-xs font-mono text-blue-400 uppercase tracking-widest mb-8 relative z-10">
                <BookOpen className="w-4 h-4" />
                Interview Plan
              </h3>
              <div className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:font-medium prose-a:text-blue-400 prose-li:text-zinc-300 relative z-10">
                <Markdown>{data.interviewPlan}</Markdown>
              </div>
            </div>

            {/* Company Insights */}
            <div className="p-8 lg:p-10 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm">
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-8">
                Company Intelligence
              </h3>
              <div className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:font-medium prose-li:text-zinc-300">
                <Markdown>{data.companyInsights}</Markdown>
              </div>
              
              {data.sources && data.sources.length > 0 && (
                <div className="mt-10 pt-8 border-t border-zinc-800/50">
                  <h4 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Sources</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.sources.map((source, i) => {
                      try {
                        const url = new URL(source);
                        return (
                          <a 
                            key={i} 
                            href={source} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-all"
                          >
                            {url.hostname}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        );
                      } catch (e) {
                        return null;
                      }
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
