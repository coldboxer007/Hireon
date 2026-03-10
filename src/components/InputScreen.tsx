import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, FileText, Briefcase, ArrowRight, ShieldCheck, Type, FileUp } from 'lucide-react';

interface InputScreenProps {
  onComplete: (resume: File, jd: File | string) => void;
}

export default function InputScreen({ onComplete }: InputScreenProps) {
  const [resume, setResume] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdText, setJdText] = useState<string>('');
  const [jdMode, setJdMode] = useState<'file' | 'text'>('file');
  
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'resume' | 'jd') => {
    e.preventDefault();
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden bg-[#050505]"
    >
      {/* Background atmospheric elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />
      </div>

      <div className="w-full max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-widest mb-2 backdrop-blur-sm shadow-[0_0_15px_rgba(59,130,246,0.15)]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Secure Environment</span>
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl lg:text-7xl font-sans font-medium tracking-tight text-white"
          >
            Tomorrow's Interview. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-600">Mastered Today.</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed"
          >
            Upload your resume and the job description. We'll extract the role, research the company, build your fit map, and run a high-stakes mock interview.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Resume Upload */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Your Resume
              </h2>
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'resume')}
              onClick={() => resumeInputRef.current?.click()}
              className={`relative group cursor-pointer border rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-500 flex-1 min-h-[300px] overflow-hidden ${
                resume 
                  ? 'border-blue-500/50 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]' 
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50 backdrop-blur-sm'
              }`}
            >
              <input 
                type="file" 
                ref={resumeInputRef} 
                onChange={(e) => handleFileChange(e, 'resume')} 
                accept="application/pdf" 
                className="hidden" 
              />
              
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
                resume 
                  ? 'bg-blue-500/20 text-blue-400 scale-110 shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
                  : 'bg-zinc-800/50 text-zinc-400 group-hover:text-zinc-300 group-hover:scale-110'
              }`}>
                <FileText className="w-10 h-10" />
              </div>
              
              <h3 className="text-xl font-medium text-zinc-200 mb-2">
                {resume ? 'Resume Uploaded' : 'Upload Resume'}
              </h3>
              <p className="text-sm text-zinc-500 font-mono">
                {resume ? resume.name : 'Drag & drop PDF or click to browse'}
              </p>
              
              {resume && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-6 right-6 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                />
              )}
            </div>
          </motion.div>

          {/* JD Input */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                Job Description
              </h2>
              <div className="flex bg-zinc-900/80 rounded-full p-1 border border-zinc-800 backdrop-blur-sm">
                <button
                  onClick={() => setJdMode('file')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                    jdMode === 'file' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <FileUp className="w-3 h-3" /> PDF
                </button>
                <button
                  onClick={() => setJdMode('text')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                    jdMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Type className="w-3 h-3" /> Text
                </button>
              </div>
            </div>

            <div className="relative flex-1 flex flex-col min-h-[300px]">
              <AnimatePresence mode="wait">
                {jdMode === 'file' ? (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, 'jd')}
                    onClick={() => jdInputRef.current?.click()}
                    className={`absolute inset-0 cursor-pointer border rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-500 overflow-hidden ${
                      jdFile 
                        ? 'border-blue-500/50 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]' 
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50 backdrop-blur-sm group'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={jdInputRef} 
                      onChange={(e) => handleFileChange(e, 'jd')} 
                      accept="application/pdf" 
                      className="hidden" 
                    />
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
                      jdFile 
                        ? 'bg-blue-500/20 text-blue-400 scale-110 shadow-[0_0_20px_rgba(59,130,246,0.2)]' 
                        : 'bg-zinc-800/50 text-zinc-400 group-hover:text-zinc-300 group-hover:scale-110'
                    }`}>
                      <Briefcase className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-medium text-zinc-200 mb-2">
                      {jdFile ? 'Job Description Uploaded' : 'Upload Job Description'}
                    </h3>
                    <p className="text-sm text-zinc-500 font-mono">
                      {jdFile ? jdFile.name : 'Drag & drop PDF or click to browse'}
                    </p>
                    {jdFile && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-6 right-6 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                      />
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="text"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    <textarea
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the job description here..."
                      className="w-full h-full resize-none bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all duration-300 backdrop-blur-sm"
                    />
                    {jdText.trim().length > 0 && jdText.trim().length < 50 && (
                      <p className="absolute bottom-4 right-6 text-xs text-amber-500/80 font-mono">
                        Please provide more details
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center pt-8"
        >
          <button
            onClick={handleComplete}
            disabled={!isReady}
            className={`group relative flex items-center gap-3 px-10 py-5 rounded-full font-medium text-lg transition-all duration-500 ${
              isReady 
                ? 'bg-white text-black hover:bg-zinc-200 hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.15)]' 
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
            }`}
          >
            Commence Prep Sequence
            <ArrowRight className={`w-5 h-5 transition-transform ${isReady ? 'group-hover:translate-x-1' : ''}`} />
            
            {isReady && (
              <div className="absolute inset-0 rounded-full border border-white/20 animate-ping" style={{ animationDuration: '3s' }} />
            )}
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
