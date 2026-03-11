import { motion } from 'motion/react';
import { ReportData } from '../types';
import { RefreshCcw, TrendingUp, TrendingDown, Eye, Activity, MessageSquare, Code, Zap } from 'lucide-react';
import Markdown from 'react-markdown';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface ReportScreenProps {
  data: ReportData;
  onRestart: () => void;
}

export default function ReportScreen({ data, onRestart }: ReportScreenProps) {
  const radarData = [
    { metric: 'Communication', score: data.metrics.communication },
    { metric: 'Technical', score: data.metrics.technical },
    { metric: 'Confidence', score: data.metrics.confidence },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-12 relative overflow-x-hidden">
      <div className="fixed inset-0 bg-[#050505] -z-10">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-900/10 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-zinc-800/50"
        >
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono uppercase tracking-widest mb-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Activity className="w-4 h-4" />
              <span>Analysis Complete</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-sans font-medium tracking-tight text-white flex items-center gap-4 justify-center">
              <img src="/logo.png" alt="Hireon" className="w-12 h-12 object-contain" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">Hireon</span> Report
            </h1>
            <p className="text-xl text-zinc-400 font-light">
              Your readiness score and tonight's crash plan.
            </p>
          </div>

          <button
            onClick={onRestart}
            className="group flex items-center gap-2 px-6 py-3 rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:bg-white hover:text-black hover:border-white transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <RefreshCcw className="w-4 h-4 transition-transform group-hover:-rotate-180 duration-500" />
            Start New Session
          </button>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Scores & Metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 space-y-8"
          >
            {/* Overall Score */}
            <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1)_0%,transparent_70%)]" />
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4 relative z-10">Readiness Score</h3>
              <div className="text-8xl font-light tracking-tighter text-white relative z-10">
                {data.overallScore}
              </div>
              <div className="mt-4 text-emerald-400 font-medium relative z-10">
                {data.overallScore >= 80 ? 'Ready for deployment.' : data.overallScore >= 60 ? 'Needs minor adjustments.' : 'Critical review required.'}
              </div>
            </div>

            {/* Radar Chart (Metrics) */}
            <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/5 blur-[50px] rounded-full" />
              <h3 className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-6 relative z-10 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Performance Radar
              </h3>
              <div className="h-[240px] w-full relative z-10 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }} 
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace' }}
                      itemStyle={{ color: '#60a5fa' }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fill="#0ea5e9"
                      fillOpacity={0.2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Metrics Bars */}
            <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 space-y-6 backdrop-blur-sm">
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Core Metrics</h3>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Communication</span>
                    <span className="text-zinc-200 font-mono">{data.metrics.communication}/100</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${data.metrics.communication}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400 flex items-center gap-2"><Code className="w-4 h-4" /> Technical</span>
                    <span className="text-zinc-200 font-mono">{data.metrics.technical}/100</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${data.metrics.technical}%` }} transition={{ duration: 1, delay: 0.3 }} className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400 flex items-center gap-2"><Zap className="w-4 h-4" /> Confidence</span>
                    <span className="text-zinc-200 font-mono">{data.metrics.confidence}/100</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${data.metrics.confidence}%` }} transition={{ duration: 1, delay: 0.4 }} className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Video Insights */}
            {data.videoInsights && (
              <div className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm">
                <h3 className="flex items-center gap-2 text-xs font-mono text-zinc-500 uppercase tracking-widest mb-6">
                  <Eye className="w-4 h-4" />
                  Behavioral Insights
                </h3>
                <div className="prose prose-invert prose-zinc prose-sm max-w-none text-zinc-400">
                  <Markdown>{data.videoInsights}</Markdown>
                </div>
              </div>
            )}
          </motion.div>

          {/* Right Column: Feedback & Action Plan */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8 space-y-8"
          >
            {/* Action Plan */}
            <div className="p-8 lg:p-10 rounded-3xl bg-blue-500/5 border border-blue-500/20 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
              <h3 className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-8">Tonight's Crash Plan</h3>
              <div className="prose prose-invert prose-blue max-w-none prose-p:leading-relaxed prose-headings:font-medium prose-a:text-blue-400 hover:prose-a:text-blue-300">
                <Markdown>{data.actionPlan}</Markdown>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Good Examples */}
              <div className="space-y-6">
                <h3 className="flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-widest">
                  <TrendingUp className="w-4 h-4" />
                  Strong Moments
                </h3>
                {data.goodExamples?.map((ex, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-zinc-900/30 border border-emerald-500/20 backdrop-blur-sm hover:border-emerald-500/40 transition-colors">
                    <p className="text-zinc-300 italic mb-4">"{ex.quote}"</p>
                    <div className="text-sm text-emerald-400/80 font-light">
                      <span className="font-medium text-emerald-400">Why it worked:</span> {ex.reason}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bad Examples */}
              <div className="space-y-6">
                <h3 className="flex items-center gap-2 text-xs font-mono text-rose-400 uppercase tracking-widest">
                  <TrendingDown className="w-4 h-4" />
                  Areas to Improve
                </h3>
                {data.badExamples?.map((ex, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-zinc-900/30 border border-rose-500/20 backdrop-blur-sm hover:border-rose-500/40 transition-colors">
                    <p className="text-zinc-400 italic mb-4 line-through decoration-rose-500/30">"{ex.quote}"</p>
                    <div className="space-y-3 text-sm font-light">
                      <div className="text-rose-400/80">
                        <span className="font-medium text-rose-400">The issue:</span> {ex.reason}
                      </div>
                      <div className="text-blue-400/80 pt-3 border-t border-zinc-800/50">
                        <span className="font-medium text-blue-400">Better approach:</span> {ex.improvement}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
