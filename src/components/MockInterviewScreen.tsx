import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Video, VideoOff, Square, Activity } from 'lucide-react';
import { PrepData } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface MockInterviewScreenProps {
  prepData: PrepData;
  onComplete: (video: Blob, transcript: string) => void;
}

export default function MockInterviewScreen({ prepData, onComplete }: MockInterviewScreenProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const currentSpeakerRef = useRef<'AI' | 'User' | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  useEffect(() => {
    // Initialize webcam
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to get media devices", err);
      }
    };
    initMedia();

    return () => {
      stopEverything();
    };
  }, []);

  const stopEverything = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
  };

  const startInterview = async () => {
    if (!streamRef.current) return;
    
    setIsConnecting(true);
    recordedChunksRef.current = [];
    
    // Compress video by drawing to a smaller canvas
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    
    const drawFrame = () => {
      if (videoRef.current && ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }
      animationFrameIdRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const canvasStream = canvas.captureStream(15); // 15 fps
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
    } catch (e) {
      console.warn('Failed to create MediaRecorder with canvas stream, falling back to original stream', e);
      mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    }
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      onComplete(blob, transcript);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);

    // Setup AudioContext for Live API
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    audioContextRef.current = audioCtx;
    nextPlayTimeRef.current = audioCtx.currentTime;

    const source = audioCtx.createMediaStreamSource(streamRef.current);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(audioCtx.destination);

    try {
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are an expert technical interviewer for the role of ${prepData.roleTitle} at ${prepData.companyName}. 
          The candidate's strengths are: ${prepData.fitMap?.strengths?.join(', ') || 'None provided'}.
          Their gaps are: ${prepData.fitMap?.gaps?.join(', ') || 'None provided'}.
          Conduct a realistic, high-stakes mock interview. Ask 3-4 questions based on their profile and the role.
          If they do well, end the interview gracefully by saying "Thank you, that concludes our interview."
          Keep your responses concise.`,
          inputAudioTranscription: { },
          outputAudioTranscription: { },
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsRecording(true);
            
            // Send audio chunks
            processor.onaudioprocess = (e) => {
              if (!micEnabled) return;
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32 to Int16
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              // Convert to Base64
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
          },
          onmessage: (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setAiSpeaking(true);
              const binaryStr = atob(base64Audio);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 0x7FFF;
              }
              
              const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
              audioBuffer.getChannelData(0).set(float32);
              
              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioCtx.destination);
              
              const playTime = Math.max(audioCtx.currentTime, nextPlayTimeRef.current);
              source.start(playTime);
              nextPlayTimeRef.current = playTime + audioBuffer.duration;
              
              source.onended = () => {
                if (audioCtx.currentTime >= nextPlayTimeRef.current - 0.1) {
                  setAiSpeaking(false);
                }
              };
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = audioCtx.currentTime;
              setAiSpeaking(false);
            }

            // Handle Transcription
            const aiTranscriptChunk = message.serverContent?.modelTurn?.parts.find(p => p.text)?.text;
            if (aiTranscriptChunk) {
              setTranscript(prev => {
                let newTranscript = prev;
                if (currentSpeakerRef.current !== 'AI') {
                  newTranscript += (prev ? '\n\n' : '') + 'AI: ';
                  currentSpeakerRef.current = 'AI';
                }
                return newTranscript + aiTranscriptChunk;
              });
              
              if (aiTranscriptChunk.toLowerCase().includes('concludes our interview')) {
                setTimeout(endInterview, 3000);
              }
            }
            
            const userTranscription = message.serverContent?.inputTranscription;
            if (userTranscription) {
              if (userTranscription.finished) {
                setTranscript(prev => {
                  let newTranscript = prev;
                  if (currentSpeakerRef.current !== 'User') {
                    newTranscript += (prev ? '\n\n' : '') + 'You: ';
                    currentSpeakerRef.current = 'User';
                  }
                  return newTranscript + userTranscription.text;
                });
                setPartialTranscript('');
              } else {
                setPartialTranscript(userTranscription.text || '');
              }
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setIsConnecting(false);
          },
          onclose: () => {
            setIsRecording(false);
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err) {
      console.error("Failed to start Live API", err);
      setIsConnecting(false);
    }
  };

  const endInterview = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopEverything();
    setIsRecording(false);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = !micEnabled);
      setMicEnabled(!micEnabled);
    }
  };

  const toggleCam = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => t.enabled = !camEnabled);
      setCamEnabled(!camEnabled);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-zinc-950/30 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          <span className="font-mono text-sm tracking-widest uppercase text-zinc-400">Live Session</span>
        </div>
        <div className="font-mono text-sm text-zinc-500">
          {prepData.companyName} <span className="text-blue-500/50">•</span> {prepData.roleTitle}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row p-6 gap-6 relative z-10">
        {/* Video Area */}
        <div className="flex-1 relative rounded-3xl overflow-hidden bg-zinc-900/50 border border-zinc-800/50 flex items-center justify-center backdrop-blur-sm shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transition-opacity duration-500 ${camEnabled ? 'opacity-100' : 'opacity-0'}`}
          />
          {!camEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
              <VideoOff className="w-12 h-12 text-zinc-700" />
            </div>
          )}
          
          {/* AI Speaking Indicator overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: aiSpeaking ? 1 : 0 }}
            className="absolute inset-0 border-4 border-blue-500/30 pointer-events-none transition-opacity duration-300 shadow-[inset_0_0_50px_rgba(59,130,246,0.1)]"
          />
          {aiSpeaking && (
            <div className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/80 backdrop-blur-md border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">AI Listening/Speaking</span>
            </div>
          )}
        </div>

        {/* Controls & Transcript */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
          {/* Controls */}
          <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-4 backdrop-blur-sm">
            {!isRecording && !isConnecting ? (
              <button 
                onClick={startInterview}
                className="w-full py-4 rounded-2xl bg-blue-500 text-white font-medium text-lg hover:bg-blue-400 transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
              >
                Start Interview
              </button>
            ) : isConnecting ? (
              <button disabled className="w-full py-4 rounded-2xl bg-zinc-800/50 text-zinc-500 font-medium text-lg flex items-center justify-center gap-2 border border-zinc-700/50">
                <Activity className="w-5 h-5 animate-spin text-blue-500" />
                Connecting...
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={toggleMic}
                  className={`flex flex-col items-center justify-center gap-2 py-3 rounded-2xl border transition-all duration-300 ${micEnabled ? 'bg-zinc-800/80 border-zinc-700/50 text-zinc-200 hover:bg-zinc-700' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'}`}
                >
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  <span className="text-xs font-mono uppercase tracking-wider">Mic</span>
                </button>
                <button 
                  onClick={toggleCam}
                  className={`flex flex-col items-center justify-center gap-2 py-3 rounded-2xl border transition-all duration-300 ${camEnabled ? 'bg-zinc-800/80 border-zinc-700/50 text-zinc-200 hover:bg-zinc-700' : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'}`}
                >
                  {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  <span className="text-xs font-mono uppercase tracking-wider">Cam</span>
                </button>
                <button 
                  onClick={endInterview}
                  className="flex flex-col items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/90 text-white hover:bg-red-500 transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] border border-red-400/50"
                >
                  <Square className="w-5 h-5 fill-current" />
                  <span className="text-xs font-mono uppercase tracking-wider">End</span>
                </button>
              </div>
            )}
          </div>

          {/* Transcript Preview */}
          <div className="flex-1 p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col overflow-hidden backdrop-blur-sm">
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4 shrink-0 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500/50" />
              Live Transcript
            </h3>
            <div className="flex-1 overflow-y-auto font-mono text-sm text-zinc-400 space-y-4 pr-2 custom-scrollbar">
              {transcript || partialTranscript ? (
                <>
                  {transcript.split('\n\n').map((block, i) => {
                    if (!block.trim()) return null;
                    const isAI = block.startsWith('AI:');
                    return (
                      <div key={i} className={isAI ? 'text-blue-400' : 'text-zinc-300'}>
                        {block}
                      </div>
                    );
                  })}
                  {partialTranscript && (
                    <div className="text-zinc-500 italic">
                      {currentSpeakerRef.current !== 'User' && transcript ? '\n\nYou: ' : ''}
                      {partialTranscript}...
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 italic font-sans font-light">
                  Transcript will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
