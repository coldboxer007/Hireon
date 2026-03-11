import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, MicOff, Video, VideoOff, Square,
  Send, Bot, User, Camera, Radio, Shield,
} from 'lucide-react';
import { PrepData, InterviewSnapshot, InterviewMode } from '../types';
import { io, Socket } from 'socket.io-client';

/* ── PCM <-> Base64 helpers ──────────────────────────────────────────────── */
function float32ToBase64_16k(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  return float32;
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const SONIC_SERVER_URL = process.env.SONIC_SERVER_URL || 'http://localhost:3001';

interface MockInterviewScreenProps {
  prepData: PrepData;
  interviewMode: InterviewMode;
  onComplete: (video: Blob, transcript: string, snapshots: InterviewSnapshot[]) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

let msgIdCounter = 0;
function nextMsgId() {
  return 'msg-' + (++msgIdCounter);
}

/* ── Dedup helper — is this text essentially the same as the last assistant msg? */
function isDuplicateAssistantMsg(prev: Message[], text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return true;
  for (let i = prev.length - 1; i >= 0; i--) {
    if (prev[i].role === 'assistant') {
      const prevTrimmed = prev[i].content.trim().toLowerCase();
      // Exact match
      if (prevTrimmed === trimmed) return true;
      // Fuzzy — share the first 40 chars (catches rephrased repeats from Sonic)
      if (prevTrimmed.length > 40 && trimmed.length > 40 && prevTrimmed.substring(0, 40) === trimmed.substring(0, 40)) return true;
      break; // only compare with the most recent assistant message
    }
  }
  return false;
}

/* ── Filter out raw JSON / protocol noise from transcript text */
function isProtocolNoise(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // Filter { "interrupted" : true }, { "error": ... } etc.
  if (/^\s*\{.*\}\s*$/.test(t)) {
    try { JSON.parse(t); return true; } catch { /* not JSON, keep it */ }
  }
  return false;
}

export default function MockInterviewScreen({ prepData, interviewMode, onComplete }: MockInterviewScreenProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [aiHasText, setAiHasText] = useState(false); // true once first text chunk of current turn arrives
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [terminated, setTerminated] = useState(false);
  const [terminateReason, setTerminateReason] = useState<string>('');
  const [warningCount, setWarningCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Snapshot refs */
  const snapshotsRef = useRef<InterviewSnapshot[]>([]);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interviewStartTimeRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Audio refs */
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micEnabledRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);

  /* Gapless audio playback */
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const drainScheduledRef = useRef(false);

  /* Transcript role tracking */
  const contentRoleMapRef = useRef<Map<string, 'user' | 'assistant'>>(new Map());
  const currentAssistantTextRef = useRef('');
  const currentUserTextRef = useRef('');
  const currentAssistantMsgIdRef = useRef<string | null>(null);
  const currentUserMsgIdRef = useRef<string | null>(null);
  const lastAssistantFinalTextRef = useRef(''); // for dedup across turns
  const warningCountRef = useRef(0);
  const terminatedRef = useRef(false);

  useEffect(() => { micEnabledRef.current = micEnabled; }, [micEnabled]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Failed to get media devices', err);
      }
    };
    initMedia();
    return () => { stopEverything(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiSpeaking]);

  const stopEverything = useCallback(() => {
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    if (snapshotIntervalRef.current) { clearInterval(snapshotIntervalRef.current); snapshotIntervalRef.current = null; }
    if (elapsedIntervalRef.current) { clearInterval(elapsedIntervalRef.current); elapsedIntervalRef.current = null; }
    if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch {} sourceNodeRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') { audioContextRef.current.close(); audioContextRef.current = null; }
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') { playbackContextRef.current.close(); playbackContextRef.current = null; }
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
  }, []);

  /* ── Gapless audio playback (24 kHz) ─────────────────────────────────── */
  const drainAudioQueue = useCallback(() => {
    const ctx = playbackContextRef.current;
    if (!ctx || audioQueueRef.current.length === 0) { drainScheduledRef.current = false; return; }
    while (audioQueueRef.current.length > 0) {
      const samples = audioQueueRef.current.shift()!;
      const buffer = ctx.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const now = ctx.currentTime;
      // 40ms lookahead — enough to absorb network jitter without audible delay
      if (nextPlayTimeRef.current < now + 0.04) nextPlayTimeRef.current = now + 0.04;
      src.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
    }
    drainScheduledRef.current = false;
  }, []);

  const enqueueAudio = useCallback((b64: string) => {
    audioQueueRef.current.push(base64ToFloat32(b64));
    if (!drainScheduledRef.current) {
      drainScheduledRef.current = true;
      drainAudioQueue(); // call directly — no extra tick of latency
    }
  }, [drainAudioQueue]);

  /* ── Start interview ───────────────────────────────────────────────── */
  const startInterview = async () => {
    if (!streamRef.current) return;
    setIsConnecting(true);
    setConnectionError(null);
    recordedChunksRef.current = [];
    snapshotsRef.current = [];
    interviewStartTimeRef.current = Date.now();
    setElapsed(0);
    contentRoleMapRef.current.clear();

    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - interviewStartTimeRef.current) / 1000));
    }, 1000);

    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const ctx2d = canvas.getContext('2d');
    const drawFrame = () => {
      if (videoRef.current && ctx2d) ctx2d.drawImage(videoRef.current, 0, 0, 320, 240);
      animationFrameIdRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const canvasStream = canvas.captureStream(15);
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    let mediaRecorder: MediaRecorder;
    try { mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' }); }
    catch { mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' }); }
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const transcript = messagesRef.current.map(m => (m.role === 'assistant' ? 'AI' : 'You') + ': ' + m.content).join('\n\n');
      onComplete(blob, transcript, snapshotsRef.current);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 480; snapCanvas.height = 360;
    const snapCtx = snapCanvas.getContext('2d');
    snapshotIntervalRef.current = setInterval(() => {
      if (videoRef.current && snapCtx && videoRef.current.readyState >= 2) {
        snapCtx.drawImage(videoRef.current, 0, 0, 480, 360);
        const b64 = snapCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        const sec = Math.round((Date.now() - interviewStartTimeRef.current) / 1000);
        snapshotsRef.current.push({ base64: b64, timestamp: sec });
        setSnapshotCount(snapshotsRef.current.length);
      }
    }, 20_000);

    playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
    nextPlayTimeRef.current = 0;
    // Resume immediately (we're inside a click handler — user gesture)
    playbackContextRef.current.resume();

    const socket = io(SONIC_SERVER_URL, { transports: ['websocket'], timeout: 15000 });
    socketRef.current = socket;

    const baseContext =
      'Role: ' + prepData.roleTitle + ' at ' + prepData.companyName + '. ' +
      'Candidate strengths: ' + (prepData.fitMap?.strengths?.join(', ') || 'not specified') + '. ' +
      'Candidate gaps: ' + (prepData.fitMap?.gaps?.join(', ') || 'not specified') + '. ' +
      'Resume risks to probe: ' + (prepData.resumeRisks?.map(r => r.risk).join('; ') || 'none identified') + '. ' +
      'Company-tailored questions to weave in: ' + (prepData.interviewerQuestions?.slice(0, 3).join('; ') || 'use your judgment') + '. ';

    const standardInstructions =
      'You are an expert interviewer conducting a realistic mock interview. ' +
      'Start by briefly introducing yourself and asking your first question. ' +
      'IMPORTANT: Ask only ONE question at a time and WAIT for the candidate to respond. ' +
      'Do NOT ask multiple questions at once. Listen to their answer, give brief feedback if appropriate, then ask the next question. ' +
      'CRITICAL: NEVER repeat the same question you already asked. If the candidate gave a vague answer, rephrase your follow-up differently. ' +
      'Weave in the company-tailored questions and gently probe the resume risks above. ' +
      'Keep your responses short — generally two or three sentences. ' +
      'BEHAVIOR RULES: ' +
      '- If the candidate is silent for too long, say "Are you still there? Let\'s continue." ONE TIME only. ' +
      '- If the candidate uses inappropriate/offensive language, give ONE warning: "Please keep this professional. This is your only warning." ' +
      '- If they continue being inappropriate after the warning, say "I\'m terminating this interview due to unprofessional conduct. Interview is over." and stop. ' +
      '- If the candidate gives completely nonsensical or off-topic answers for 2+ questions in a row, say "I don\'t think you\'re taking this seriously. This interview is concluded." ' +
      'After 3-4 good questions total, wrap up by saying "Thank you, that concludes our interview."';

    const pressureInstructions =
      'You are a tough, senior interviewer known for aggressive, no-nonsense interviews. ' +
      'Your style: direct, skeptical, push-back on vague answers, demand specifics with follow-ups. ' +
      'Start with a brief cold introduction — no pleasantries — then immediately hit with a hard question. ' +
      'IMPORTANT: Ask only ONE question at a time, but follow up aggressively if the answer is vague. ' +
      'CRITICAL: NEVER repeat the same question verbatim. If you need to press harder, rephrase differently or move on. ' +
      'Actively probe the resume risks listed above — challenge job-hopping, missing metrics, skill gaps. ' +
      'Use the company-tailored questions. If the candidate gives a generic answer, say "Be more specific" or "That doesn\'t answer my question." ' +
      'Keep responses short and blunt — one or two sentences max. ' +
      'BEHAVIOR RULES: ' +
      '- If the candidate uses inappropriate/offensive language, give ONE cold warning: "Watch your language. Final warning." ' +
      '- If they continue, say "Terminating this interview. Your conduct is unacceptable." and stop. ' +
      '- If the candidate is clearly not serious or giving gibberish answers, say "This is a waste of time. Interview is over." ' +
      'After 4-5 good questions total, wrap up by saying "Thank you, that concludes our interview."';

    const systemPrompt = baseContext + (interviewMode === 'pressure' ? pressureInstructions : standardInstructions);

    socket.on('connect', () => { socket.emit('startSession', { systemPrompt }); });
    socket.on('connect_error', (err) => { setIsConnecting(false); setConnectionError('Cannot connect to Sonic server (' + err.message + ')'); });

    socket.on('sessionReady', () => {
      setIsConnecting(false);
      setIsRecording(true);
      // Resume AudioContext (required after user gesture in browsers)
      playbackContextRef.current?.resume();
      startAudioCapture(socket);
    });

    socket.on('contentStart', (data: { role?: string; contentName?: string }) => {
      const role = data?.role;
      const cn = data?.contentName;
      if (cn && role) contentRoleMapRef.current.set(cn, role === 'ASSISTANT' ? 'assistant' : 'user');
      if (role === 'ASSISTANT') {
        currentAssistantTextRef.current = '';
        currentAssistantMsgIdRef.current = null; // defer bubble creation until first text
        setIsAiSpeaking(true);
        setAiHasText(false); // show typing dots
      } else if (role === 'USER') {
        currentUserTextRef.current = '';
        currentUserMsgIdRef.current = null; // defer bubble creation until first text
      }
    });

    socket.on('textOutput', (data: { content?: string; role?: string; contentName?: string }) => {
      const text = data?.content || '';
      if (!text) return;
      let role: 'user' | 'assistant' | null = null;
      if (data?.role === 'ASSISTANT') role = 'assistant';
      else if (data?.role === 'USER') role = 'user';
      else if (data?.contentName) role = contentRoleMapRef.current.get(data.contentName) || null;

      // Filter protocol noise like { "interrupted": true }
      if (isProtocolNoise(text)) return;

      if (role === 'assistant') {
        currentAssistantTextRef.current += text;
        const full = currentAssistantTextRef.current;

        // Skip if this is a duplicate of the last assistant message
        if (isDuplicateAssistantMsg(messagesRef.current, full)) {
          // Still accumulate text but don't create/update a bubble
          return;
        }

        let tid = currentAssistantMsgIdRef.current;
        if (!tid) {
          // First text chunk — create the bubble now (no empty bubble)
          tid = nextMsgId();
          currentAssistantMsgIdRef.current = tid;
          setAiHasText(true); // hide typing dots
          setMessages(prev => [...prev, { role: 'assistant', content: full, id: tid! }]);
        } else {
          setMessages(prev => prev.map(m => m.id === tid ? { ...m, content: full } : m));
        }
      } else if (role === 'user') {
        currentUserTextRef.current += text;
        const full = currentUserTextRef.current;
        let tid = currentUserMsgIdRef.current;
        if (!tid) {
          tid = nextMsgId();
          currentUserMsgIdRef.current = tid;
          setMessages(prev => [...prev, { role: 'user', content: full, id: tid! }]);
        } else {
          setMessages(prev => prev.map(m => m.id === tid ? { ...m, content: full } : m));
        }
      }
    });

    socket.on('audioOutput', (data: { content?: string }) => { if (data?.content) enqueueAudio(data.content); });

    socket.on('contentEnd', (data: { role?: string; contentName?: string }) => {
      if (data?.contentName) contentRoleMapRef.current.delete(data.contentName);
      if (data?.role === 'ASSISTANT') {
        const finalText = currentAssistantTextRef.current.trim();
        const finalLower = finalText.toLowerCase();
        const currentBubbleId = currentAssistantMsgIdRef.current;

        // ── Retroactive dedup: if this completed turn matches the previous assistant msg, delete the bubble
        if (currentBubbleId && lastAssistantFinalTextRef.current) {
          const prevLower = lastAssistantFinalTextRef.current;
          const isDupe = (prevLower === finalLower) ||
            (prevLower.length > 40 && finalLower.length > 40 && prevLower.substring(0, 40) === finalLower.substring(0, 40));
          if (isDupe) {
            setMessages(prev => prev.filter(m => m.id !== currentBubbleId));
            currentAssistantMsgIdRef.current = null;
            setIsAiSpeaking(false);
            return; // skip all further processing for this duplicate turn
          }
        }

        // Save final text for cross-turn dedup
        if (finalText) {
          lastAssistantFinalTextRef.current = finalLower;
        }
        currentAssistantMsgIdRef.current = null;
        setIsAiSpeaking(false);

        // Check for interview conclusion phrases
        if (finalLower.includes('concludes our interview') || finalLower.includes('interview is over') ||
            finalLower.includes('terminating this interview') || finalLower.includes('ending this interview') ||
            finalLower.includes('interview has been terminated') || finalLower.includes('this interview is concluded') ||
            finalLower.includes('conduct is unacceptable') || finalLower.includes('waste of time')) {
          terminateInterview(finalText.length > 120 ? finalText.slice(0, 120) + '…' : finalText);
        }

        // Check for AI-issued warnings about candidate behavior
        if (finalLower.includes('final warning') || finalLower.includes('last chance') || finalLower.includes('one more chance') ||
            finalLower.includes('only warning') || finalLower.includes('watch your language') || finalLower.includes('keep this professional')) {
          warningCountRef.current += 1;
          setWarningCount(warningCountRef.current);
        }
      } else if (data?.role === 'USER') {
        // Check user transcript for inappropriate content or nonsense
        const userText = currentUserTextRef.current.trim().toLowerCase();
        if (userText && !terminatedRef.current) {
          const inappropriatePatterns = /\b(fuck|shit|damn|ass|bitch|dick|pussy|cock|cunt|bastard|wtf|stfu|idiot|stupid|dumb)\b/i;
          if (inappropriatePatterns.test(userText)) {
            warningCountRef.current += 1;
            setWarningCount(warningCountRef.current);
            if (warningCountRef.current >= 2) {
              terminateInterview('Inappropriate language detected. Interview terminated.');
            }
          }
        }
        currentUserMsgIdRef.current = null;
      }
    });

    socket.on('error', (data: { message?: string }) => { setConnectionError(data?.message || 'Unknown server error'); });
  };

  const startAudioCapture = (socket: Socket) => {
    if (!streamRef.current) return;
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(streamRef.current);
    sourceNodeRef.current = source;
    // 4096 buffer = ~256ms chunks — reduces socket emission frequency and jitter
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    processor.onaudioprocess = (e) => {
      if (!micEnabledRef.current) return;
      socket.emit('audioChunk', float32ToBase64_16k(e.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !isRecording || !socketRef.current) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: text, id: nextMsgId() }]);
    socketRef.current.emit('textInput', text);
  };

  const endInterview = () => {
    if (socketRef.current) socketRef.current.emit('endSession');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    stopEverything();
    setIsRecording(false);
  };

  const terminateInterview = (reason: string) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    setTerminated(true);
    setTerminateReason(reason);
    setInterviewEnded(true);
    setIsAiSpeaking(false);

    // Stop the sonic session and audio, but do NOT trigger mediaRecorder.stop()
    // (that would fire onComplete and transition away before user sees the banner)
    if (socketRef.current) { socketRef.current.emit('endSession'); socketRef.current.disconnect(); socketRef.current = null; }
    if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch {} sourceNodeRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch {} processorRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') { audioContextRef.current.close(); audioContextRef.current = null; }
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') { playbackContextRef.current.close(); playbackContextRef.current = null; }
    if (snapshotIntervalRef.current) { clearInterval(snapshotIntervalRef.current); snapshotIntervalRef.current = null; }
    if (elapsedIntervalRef.current) { clearInterval(elapsedIntervalRef.current); elapsedIntervalRef.current = null; }
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    setIsRecording(false);
  };

  const handleTerminatedTryAgain = () => {
    // Reset all state so user can start fresh
    setTerminated(false);
    setTerminateReason('');
    terminatedRef.current = false;
    warningCountRef.current = 0;
    setWarningCount(0);
    setInterviewEnded(false);
    setIsRecording(false);
    setMessages([]);
    lastAssistantFinalTextRef.current = '';
    // Stop media recorder without triggering onComplete
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
    snapshotsRef.current = [];
  };

  const handleTerminatedViewResults = () => {
    // Proceed to analysis with whatever we have
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // triggers onstop → onComplete
    } else {
      // MediaRecorder already stopped, build blob manually
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const transcript = messagesRef.current.map(m => (m.role === 'assistant' ? 'AI' : 'You') + ': ' + m.content).join('\n\n');
      onComplete(blob, transcript, snapshotsRef.current);
    }
  };

  const toggleMic = () => {
    if (streamRef.current) { streamRef.current.getAudioTracks().forEach(t => t.enabled = !micEnabled); setMicEnabled(!micEnabled); }
  };

  const toggleCam = () => {
    if (streamRef.current) { streamRef.current.getVideoTracks().forEach(t => t.enabled = !camEnabled); setCamEnabled(!camEnabled); }
  };

  const fmt = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  return (
    <div className="h-screen bg-[#030308] flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-900/10 to-transparent blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-blue-900/8 blur-[80px] rounded-full" />
        {/* Floating particles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={'p' + i}
            className="absolute rounded-full"
            style={{
              width: 2 + (i % 3) * 1.5,
              height: 2 + (i % 3) * 1.5,
              left: `${8 + (i * 7.5) % 85}%`,
              top: `${10 + (i * 13) % 80}%`,
              background: i % 2 === 0 ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.25)',
            }}
            animate={{
              y: [0, -(20 + i * 4), 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 4 + (i % 4) * 1.5,
              repeat: Infinity,
              delay: i * 0.6,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* ── FULL-SCREEN TERMINATION OVERLAY ── */}
      <AnimatePresence>
        {terminated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-w-md w-full mx-4 p-8 rounded-2xl bg-[#0a0a14] border border-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.15)] text-center"
            >
              {/* Red pulse icon */}
              <div className="relative w-16 h-16 mx-auto mb-5">
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-red-500/20"
                />
                <div className="absolute inset-0 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
                  <Square className="w-6 h-6 text-red-400 fill-current" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-red-400 mb-2">Interview Terminated</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-xs mx-auto">
                {terminateReason}
              </p>

              {/* Stats */}
              <div className="flex items-center justify-center gap-6 mb-8 text-[10px] font-mono text-zinc-600">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-zinc-400 text-lg tabular-nums">{fmt(elapsed)}</span>
                  <span className="uppercase tracking-[0.15em]">Duration</span>
                </div>
                <div className="w-px h-8 bg-white/[0.06]" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-zinc-400 text-lg tabular-nums">{messages.filter(m => m.role === 'user').length}</span>
                  <span className="uppercase tracking-[0.15em]">Responses</span>
                </div>
                <div className="w-px h-8 bg-white/[0.06]" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-red-400 text-lg tabular-nums">{warningCount}</span>
                  <span className="uppercase tracking-[0.15em]">Warnings</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleTerminatedTryAgain}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-sm
                    hover:from-purple-500 hover:to-blue-500 transition-all duration-200
                    shadow-[0_0_24px_rgba(139,92,246,0.25)] hover:shadow-[0_0_32px_rgba(139,92,246,0.4)]
                    flex items-center justify-center gap-2 border border-white/[0.06]"
                >
                  <Mic className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={handleTerminatedViewResults}
                  className="w-full py-3 rounded-xl bg-white/[0.04] text-zinc-300 font-medium text-sm
                    hover:bg-white/[0.08] transition-all duration-200
                    flex items-center justify-center gap-2 border border-white/[0.06]"
                >
                  View Results Anyway
                </button>
              </div>

              <p className="text-[10px] text-zinc-700 mt-4 font-mono">
                Tip: Stay professional and answer questions thoughtfully for best results.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="relative z-20 h-12 flex items-center justify-between px-4 border-b border-white/[0.04] bg-black/60 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Hireon" className="w-6 h-6 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400">Hireon</span>
          <div className="w-px h-4 bg-white/[0.08]" />
          {isRecording ? (
            <div className="flex items-center gap-1.5">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="font-mono text-[10px] text-red-400/80 tracking-[0.2em] uppercase">Live</span>
              <span className="font-mono text-[10px] text-zinc-600 tabular-nums ml-1">{fmt(elapsed)}</span>
            </div>
          ) : isConnecting ? (
            <div className="flex items-center gap-1.5">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-mono text-[10px] text-amber-400/80 tracking-[0.2em] uppercase">Connecting</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
              <span className="font-mono text-[10px] text-zinc-600 tracking-[0.2em] uppercase">Standby</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/8 border border-purple-500/15">
            <Radio className="w-2.5 h-2.5 text-purple-400" />
            <span className="text-[9px] font-mono text-purple-300/70 tracking-[0.12em] uppercase">Nova 2 Sonic</span>
          </div>
          {warningCount > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <span className="text-[9px] font-mono text-red-400 tracking-[0.12em] uppercase">⚠ {warningCount}/2 Warning{warningCount > 1 ? 's' : ''}</span>
            </motion.div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.05]">
            <Shield className="w-2.5 h-2.5 text-zinc-600" />
            <span className="text-[9px] font-mono text-zinc-600">{prepData.companyName} · {prepData.roleTitle}</span>
          </div>
        </div>
      </header>

      {/* Main — fixed height, never grows */}
      <main className="flex-1 flex flex-col lg:flex-row gap-2.5 p-2.5 relative z-10 min-h-0 overflow-hidden">

        {/* Video panel — fixed proportions */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
          <div className={'relative flex-1 rounded-xl overflow-hidden bg-black border transition-all duration-500 min-h-0 ' + (isAiSpeaking ? 'border-purple-500/30 shadow-[0_0_30px_rgba(139,92,246,0.12)]' : 'border-white/[0.04]')}>
            <video ref={videoRef} autoPlay playsInline muted className={'absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ' + (camEnabled ? 'opacity-100' : 'opacity-0')} />

            {!camEnabled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <VideoOff className="w-8 h-8 text-zinc-700" />
                  <span className="text-[10px] font-mono text-zinc-700">Camera Off</span>
                </div>
              </div>
            )}

            {/* Corner brackets */}
            <div className="absolute top-2.5 left-2.5 w-6 h-6 border-t-2 border-l-2 border-blue-500/20 rounded-tl pointer-events-none" />
            <div className="absolute top-2.5 right-2.5 w-6 h-6 border-t-2 border-r-2 border-blue-500/20 rounded-tr pointer-events-none" />
            <div className="absolute bottom-2.5 left-2.5 w-6 h-6 border-b-2 border-l-2 border-blue-500/20 rounded-bl pointer-events-none" />
            <div className="absolute bottom-2.5 right-2.5 w-6 h-6 border-b-2 border-r-2 border-blue-500/20 rounded-br pointer-events-none" />

            {/* Top-left badges */}
            <AnimatePresence>
              {isRecording && (
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="absolute top-3 left-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-md border border-red-500/20">
                    <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[9px] font-mono text-red-400 uppercase tracking-widest">REC</span>
                  </div>
                  {snapshotCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-md border border-cyan-500/15">
                      <Camera className="w-2.5 h-2.5 text-cyan-400/60" />
                      <span className="text-[9px] font-mono text-cyan-400/50">{snapshotCount} snap</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI speaking waveform */}
            <AnimatePresence>
              {isAiSpeaking && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-1.5 px-4 pb-3 pt-2 rounded-b-xl bg-gradient-to-t from-black/90 via-black/60 to-transparent backdrop-blur-sm">
                  {/* Bars */}
                  <div className="flex items-end gap-[3px] h-8">
                    {[0.4, 0.7, 1.0, 0.8, 0.6, 0.9, 1.0, 0.75, 0.5, 0.85, 1.0, 0.65, 0.45, 0.8, 0.95, 0.6, 0.4, 0.7, 1.0, 0.8].map((amp, i) => (
                      <motion.div
                        key={i}
                        className="w-[3px] rounded-full"
                        style={{
                          background: `linear-gradient(to top, #a855f7, #7c3aed${i % 3 === 0 ? ', #60a5fa' : ''})`,
                          boxShadow: i % 4 === 0 ? '0 0 6px rgba(168,85,247,0.7)' : undefined,
                        }}
                        animate={{ height: ['3px', `${Math.round(amp * 28)}px`, '3px'] }}
                        transition={{ duration: 0.35 + (i % 5) * 0.06, repeat: Infinity, delay: i * 0.04, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                  {/* Label */}
                  <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-purple-300/50">Nova is speaking</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connecting overlay */}
            <AnimatePresence>
              {isConnecting && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center gap-5 z-10">
                  <div className="relative w-12 h-12">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 border-r-blue-500/40" />
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="absolute inset-2 rounded-full border border-transparent border-t-blue-500/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-mono text-zinc-400 tracking-[0.2em] uppercase">Establishing Link</p>
                    <p className="text-[10px] font-mono text-zinc-700 mt-1">Connecting to Nova 2 Sonic…</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls bar */}
          <AnimatePresence>
            {isRecording && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/60 border border-white/[0.05] backdrop-blur-sm shrink-0">
                <div className="flex gap-2">
                  <button onClick={toggleMic} title={micEnabled ? 'Mute mic' : 'Unmute mic'}
                    className={'w-9 h-9 rounded-xl border flex items-center justify-center transition-all ' +
                      (micEnabled ? 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'
                                  : 'bg-red-500/15 border-red-500/25 text-red-400')}>
                    {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button onClick={toggleCam} title={camEnabled ? 'Hide camera' : 'Show camera'}
                    className={'w-9 h-9 rounded-xl border flex items-center justify-center transition-all ' +
                      (camEnabled ? 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200'
                                  : 'bg-red-500/15 border-red-500/25 text-red-400')}>
                    {camEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-700 tabular-nums">
                  {fmt(elapsed)}
                </div>
                <button onClick={endInterview}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition-all text-xs font-medium border border-red-400/20 shadow-[0_0_16px_rgba(239,68,68,0.2)] hover:shadow-[0_0_24px_rgba(239,68,68,0.35)]">
                  <Square className="w-2.5 h-2.5 fill-current" />
                  End
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transcript panel — FIXED height, internal scroll only */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col rounded-xl bg-[#0a0a12]/90 border border-white/[0.05] backdrop-blur-sm overflow-hidden shrink-0 h-[300px] lg:h-auto">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between shrink-0 bg-black/30">
            <div className="flex items-center gap-2">
              <div className={'w-1.5 h-1.5 rounded-full transition-all duration-500 ' + (isRecording ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-700')} />
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">Transcript</span>
            </div>
            <div className="flex items-center gap-3">
              {isRecording && !isAiSpeaking && (
                <span className="text-[9px] font-mono text-emerald-500/60 tracking-wider flex items-center gap-1">
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
                  Listening
                </span>
              )}
              {isAiSpeaking && (
                <span className="text-[9px] font-mono text-purple-400/60 tracking-wider flex items-center gap-1">
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-1 h-1 rounded-full bg-purple-400 inline-block" />
                  AI Speaking
                </span>
              )}
            </div>
          </div>

          {/* Messages — scrollable container */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 custom-scrollbar min-h-0">
            {messages.filter(m => m.content.trim().length > 0).length === 0 && !isRecording && !isConnecting && !connectionError && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-12 h-12 rounded-xl bg-purple-500/6 border border-purple-500/10 flex items-center justify-center mb-3">
                  <Bot className="w-6 h-6 text-purple-500/25" />
                </div>
                <p className="text-[11px] text-zinc-600 font-medium">Ready for your interview</p>
                <p className="text-[10px] text-zinc-700 mt-1 font-mono">Nova 2 Sonic · Speech-to-Speech</p>
              </div>
            )}

            {connectionError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                <p className="text-[10px] font-mono font-semibold text-red-400 mb-1">⚠ Connection Failed</p>
                <p className="text-[10px] text-red-400/60 leading-relaxed">{connectionError}</p>
                <p className="text-[10px] text-zinc-600 mt-2">Make sure the Sonic server is running:<br />
                  <code className="text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded text-[9px]">npm run sonic</code>
                </p>
              </motion.div>
            )}

            {messages.filter(m => m.content.trim().length > 0).map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={'flex gap-2.5 ' + (msg.role === 'user' ? 'flex-row-reverse' : '')}>
                <div className={'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ' +
                  (msg.role === 'assistant' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400')}>
                  {msg.role === 'assistant' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                </div>
                <div className={'flex flex-col gap-1 max-w-[85%] ' + (msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <span className={'text-[9px] font-mono uppercase tracking-wider px-0.5 ' +
                    (msg.role === 'assistant' ? 'text-purple-400/40' : 'text-blue-400/40')}>
                    {msg.role === 'assistant' ? 'Interviewer' : 'You'}
                  </span>
                  <div className={'px-3.5 py-2.5 rounded-2xl text-[13px] leading-[1.6] break-words ' +
                    (msg.role === 'assistant'
                      ? 'bg-[#1a1025] border border-purple-500/15 text-zinc-200 rounded-tl-sm'
                      : 'bg-[#0d1a2e] border border-blue-500/15 text-zinc-200 rounded-tr-sm')}>
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator — only show when AI is speaking and no current message content yet */}
            <AnimatePresence>
              {isAiSpeaking && !aiHasText && (
                <motion.div key="typing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                  className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-purple-500/15 text-purple-400">
                    <Bot className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-[9px] font-mono uppercase tracking-wider px-0.5 text-purple-400/40">Interviewer</span>
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#1a1025] border border-purple-500/15">
                      <span className="flex items-center gap-1 text-zinc-500">
                        <motion.span className="text-[8px]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity }}>●</motion.span>
                        <motion.span className="text-[8px]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: 0.2 }}>●</motion.span>
                        <motion.span className="text-[8px]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: 0.4 }}>●</motion.span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {interviewEnded && !terminated && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-center">
                <p className="text-[11px] font-mono font-semibold text-emerald-400">Interview Complete</p>
                <p className="text-[10px] text-emerald-400/50 mt-0.5">Generating analysis…</p>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom input / start button */}
          <div className="px-3 py-3 border-t border-white/[0.04] shrink-0">
            {!isRecording && !isConnecting ? (
              <button onClick={startInterview}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-sm
                  hover:from-purple-500 hover:to-blue-500 transition-all duration-200
                  shadow-[0_0_24px_rgba(139,92,246,0.25)] hover:shadow-[0_0_32px_rgba(139,92,246,0.4)]
                  flex items-center justify-center gap-2 border border-white/[0.06]">
                <Mic className="w-4 h-4" />
                Start Voice Interview
              </button>
            ) : isConnecting ? (
              <div className="w-full py-3 rounded-xl bg-zinc-900/50 border border-white/[0.04] flex items-center justify-center gap-2 text-zinc-500 text-sm">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-3.5 h-3.5 rounded-full border-2 border-purple-500/30 border-t-purple-400" />
                Connecting to Sonic…
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Or type a message…"
                  disabled={interviewEnded}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-purple-500/30 transition-colors text-[13px] disabled:opacity-30"
                />
                <button onClick={handleSendMessage} disabled={!inputText.trim() || interviewEnded}
                  className="px-3 py-2 rounded-lg bg-purple-600/70 hover:bg-purple-500/80 text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-purple-400/15">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
