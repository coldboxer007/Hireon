import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Briefcase, ArrowRight, Type, FileUp, Sparkles, CheckCircle2, Upload } from 'lucide-react';

interface InputScreenProps {
  onComplete: (resume: File, jd: File | string) => void;
}

export default function InputScreen({ onComplete }: InputScreenProps) {
  const [resume, setResume] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState<string>('');
  const [jdMode, setJdMode] = useState<'file' | 'text'>('file');
  const [resumeDragging, setResumeDragging] = useState(false);
  const [jdDragging, setJdDragging] = useState(false);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'resume' | 'jd') => {
    e.preventDefault();
    type === 'resume' ? setResumeDragging(false) : setJdDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      type === 'resume' ? setResume(file) : setJdFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'jd') => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      type === 'resume' ? setResume(file) : setJdFile(file);
    }
  };

  const isReady = resume && (jdMode === 'file' ? jdFile : jdText.trim().length > 50);

  const handleComplete = () => {
    if (isReady) {
      onComplete(resume, jdMode === 'file' ? jdFile! : jdText);
    }
  };

  return (
    <div className="min-h-screen bg-[#070710] flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden">

      {/* Background glow blobs — static, no CSS animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full bg-blue-950/60 blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[50%] rounded-full bg-indigo-950/50 blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,transparent_30%,#070710_80%)]" />
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-14 relative z-10">

        {/* Hero text */}
        <div className="text-center space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/25 bg-blue-500/8 text-blue-400 text-[11px] font-mono uppercase tracking-widest backdrop-blur-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Your Unfair Interview Advantage
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="text-5xl lg:text-[5.5rem] font-light tracking-[-0.03em] text-white leading-[1.05]"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 font-semibold">Hireeon</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-500 text-4xl lg:text-5xl">
              Nail Every Interview.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-base text-zinc-500 max-w-xl mx-auto leading-relaxed"
          >
            Upload your resume and job description. Hireeon researches the company, maps your fit, and runs a live AI mock interview — powered by Amazon Nova.
          </motion.p>
        </div>

        {/* Upload cards */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* Resume card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="flex flex-col gap-3"
          >
            <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] px-1">Resume · PDF</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setResumeDragging(true); }}
              onDragLeave={() => setResumeDragging(false)}
              onDrop={(e) => handleDrop(e, 'resume')}
              onClick={() => resumeInputRef.current?.click()}
              className={`group relative cursor-pointer rounded-2xl border-2 transition-all duration-300 min-h-[220px] flex flex-col items-center justify-center gap-4 p-8 text-center overflow-hidden
                ${resume
                  ? 'border-blue-500/40 bg-blue-500/5 shadow-[0_0_40px_rgba(59,130,246,0.08)]'
                  : resumeDragging
                  ? 'border-blue-400/50 bg-blue-500/8 scale-[1.01]'
                  : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40'
                }`}
            >
              <input type="file" ref={resumeInputRef} onChange={(e) => handleFileChange(e, 'resume')} accept="application/pdf" className="hidden" />

              {/* Subtle corner accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/20 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500/20 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500/20 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/20 rounded-br-2xl" />

              <AnimatePresence mode="wait">
                {resume ? (
                  <motion.div key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{resume.name}</p>
                      <p className="text-xs text-zinc-600 font-mono mt-0.5">{(resume.size / 1024).toFixed(0)} KB · PDF</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                      <FileText className="w-7 h-7 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-400">Drop your resume</p>
                      <p className="text-xs text-zinc-600 font-mono mt-0.5">or click to browse</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700 border border-zinc-800 rounded-full px-3 py-1 mt-1">
                      <Upload className="w-2.5 h-2.5" /> PDF only
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* JD card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-1">
              <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">Job Description</label>
              <div className="flex bg-zinc-900/60 rounded-full p-0.5 border border-zinc-800 backdrop-blur-sm">
                <button
                  onClick={() => setJdMode('file')}
                  className={`px-3 py-1 text-[10px] font-mono rounded-full transition-all flex items-center gap-1 ${jdMode === 'file' ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  <FileUp className="w-2.5 h-2.5" /> PDF
                </button>
                <button
                  onClick={() => setJdMode('text')}
                  className={`px-3 py-1 text-[10px] font-mono rounded-full transition-all flex items-center gap-1 ${jdMode === 'text' ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  <Type className="w-2.5 h-2.5" /> Text
                </button>
              </div>
            </div>

            <div className="relative min-h-[220px]">
              <AnimatePresence mode="wait">
                {jdMode === 'file' ? (
                  <motion.div
                    key="jd-file"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    onDragOver={(e) => { e.preventDefault(); setJdDragging(true); }}
                    onDragLeave={() => setJdDragging(false)}
                    onDrop={(e) => handleDrop(e, 'jd')}
                    onClick={() => jdInputRef.current?.click()}
                    className={`cursor-pointer rounded-2xl border-2 transition-all duration-300 h-full min-h-[220px] flex flex-col items-center justify-center gap-4 p-8 text-center overflow-hidden absolute inset-0
                      ${jdFile
                        ? 'border-blue-500/40 bg-blue-500/5 shadow-[0_0_40px_rgba(59,130,246,0.08)]'
                        : jdDragging
                        ? 'border-blue-400/50 bg-blue-500/8 scale-[1.01]'
                        : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40 group'
                      }`}
                  >
                    <input type="file" ref={jdInputRef} onChange={(e) => handleFileChange(e, 'jd')} accept="application/pdf" className="hidden" />
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500/20 rounded-tl-2xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500/20 rounded-tr-2xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500/20 rounded-bl-2xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500/20 rounded-br-2xl" />
                    <AnimatePresence mode="wait">
                      {jdFile ? (
                        <motion.div key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{jdFile.name}</p>
                            <p className="text-xs text-zinc-600 font-mono mt-0.5">{(jdFile.size / 1024).toFixed(0)} KB · PDF</p>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 flex items-center justify-center hover:bg-zinc-800 transition-colors">
                            <Briefcase className="w-7 h-7 text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-400">Drop job description</p>
                            <p className="text-xs text-zinc-600 font-mono mt-0.5">or click to browse</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700 border border-zinc-800 rounded-full px-3 py-1 mt-1">
                            <Upload className="w-2.5 h-2.5" /> PDF only
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div
                    key="jd-text"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0"
                  >
                    <textarea
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the full job description here…"
                      className="w-full h-full min-h-[220px] resize-none bg-zinc-900/20 border-2 border-zinc-800 rounded-2xl p-5 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors leading-relaxed"
                    />
                    {jdText.trim().length > 0 && jdText.trim().length < 50 && (
                      <p className="absolute bottom-3 right-4 text-[10px] font-mono text-amber-500/70">Need more content</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.36 }}
          className="flex flex-col items-center gap-4"
        >
          <button
            onClick={handleComplete}
            disabled={!isReady}
            className={`group relative flex items-center gap-3 px-10 py-4 rounded-full font-medium text-base transition-all duration-300 overflow-hidden
              ${isReady
                ? 'bg-white text-black hover:bg-zinc-100 shadow-[0_0_50px_rgba(255,255,255,0.12)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] hover:scale-[1.03]'
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
              }`}
          >
            Begin Prep Sequence
            <ArrowRight className={`w-4 h-4 transition-transform ${isReady ? 'group-hover:translate-x-1' : ''}`} />
          </button>

          <p className="text-[11px] font-mono text-zinc-700">
            {isReady ? 'Ready — click to start →' : `${!resume ? 'Upload resume' : 'Add job description'} to continue`}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
