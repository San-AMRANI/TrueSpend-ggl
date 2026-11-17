import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Square,
  AlertCircle,
  AudioLines,
} from 'lucide-react';
import { SpexAvatar } from '../common/SpexAvatar';
import { cn } from '../../lib/utils';
import { getWebSocketUrl } from '../../lib/capacitorBridge';

export const GEMINI_LIVE_VOICES = [
  { id: 'Zephyr', label: 'Zephyr', tone: 'Bright & Clear' },
  { id: 'Puck', label: 'Puck', tone: 'Upbeat & Crisp' },
  { id: 'Kore', label: 'Kore', tone: 'Calm & Composed' },
  { id: 'Fenrir', label: 'Fenrir', tone: 'Deep & Direct' },
  { id: 'Charon', label: 'Charon', tone: 'Warm & Steady' },
] as const;

export type GeminiLiveVoiceId = (typeof GEMINI_LIVE_VOICES)[number]['id'];

interface LiveTurnEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface LiveVoiceSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  aiContext: unknown;
  focusScopes: string[];
  onTurnCommitted?: (userTranscript: string, assistantTranscript: string) => void;
}

function downsampleTo16kHz(samples: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return samples;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < samples.length; i++) {
      accum += samples[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const byteLength = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const numSamples = byteLength / 2;
  const float32 = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / 32768;
  }
  return float32;
}

const LIVE_QUICK_PROMPTS = [
  'What can I safely spend today and how are my wallets balanced?',
  'Walk me through my live Binance and stock positions.',
  'Where did I spend the most money this financial cycle?',
];

export const LiveVoiceSessionModal: React.FC<LiveVoiceSessionModalProps> = ({
  isOpen,
  onClose,
  token,
  aiContext,
  focusScopes,
  onTurnCommitted,
}) => {
  const [status, setStatus] = useState<'connecting' | 'ready' | 'speaking' | 'error' | 'closed'>(
    'connecting',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<GeminiLiveVoiceId>(() => {
    const saved = localStorage.getItem('truespend_live_voice') as GeminiLiveVoiceId | null;
    if (saved && GEMINI_LIVE_VOICES.some((v) => v.id === saved)) return saved;
    return 'Zephyr';
  });
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
  const [history, setHistory] = useState<LiveTurnEntry[]>([]);
  const [micLevel, setMicLevel] = useState(0);

  // Refs for real-time audio & WebSocket callbacks (prevent stale closures per Live API rules)
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef<boolean>(false);
  const isSpeakerMutedRef = useRef<boolean>(false);
  const userTranscriptAccRef = useRef<string>('');
  const assistantTranscriptAccRef = useRef<string>('');
  const onTurnCommittedRef = useRef(onTurnCommitted);
  const aiContextRef = useRef(aiContext);
  const focusScopesRef = useRef(focusScopes);

  useEffect(() => {
    onTurnCommittedRef.current = onTurnCommitted;
  }, [onTurnCommitted]);

  useEffect(() => {
    aiContextRef.current = aiContext;
    focusScopesRef.current = focusScopes;
  }, [aiContext, focusScopes]);

  const stopQueuedOutputAudio = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const flushCompletedTurn = useCallback(() => {
    const userTxt = userTranscriptAccRef.current.trim();
    const assistantTxt = assistantTranscriptAccRef.current.trim();
    if (!userTxt && !assistantTxt) return;

    setHistory((prev) => {
      const next = [...prev];
      if (userTxt) {
        next.push({ id: `u_${Date.now()}_${Math.random()}`, role: 'user', text: userTxt });
      }
      if (assistantTxt) {
        next.push({
          id: `a_${Date.now()}_${Math.random()}`,
          role: 'assistant',
          text: assistantTxt,
        });
      }
      return next.slice(-16);
    });

    if (onTurnCommittedRef.current && (userTxt || assistantTxt)) {
      onTurnCommittedRef.current(userTxt, assistantTxt);
    }

    userTranscriptAccRef.current = '';
    assistantTranscriptAccRef.current = '';
    setLiveUserTranscript('');
    setLiveAssistantTranscript('');
  }, []);

  const scheduleOutputPcmChunk = useCallback(
    (base64Pcm: string) => {
      if (isSpeakerMutedRef.current) return;
      let outCtx = outputAudioCtxRef.current;
      if (!outCtx || outCtx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        outCtx = new AudioCtx({ sampleRate: 24000 });
        outputAudioCtxRef.current = outCtx;
      }
      if (outCtx.state === 'suspended') {
        outCtx.resume().catch(() => {});
      }

      const float32 = base64Pcm16ToFloat32(base64Pcm);
      if (float32.length === 0) return;

      const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = outCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outCtx.destination);

      const now = outCtx.currentTime;
      const startAt = Math.max(now + 0.01, nextStartTimeRef.current);
      nextStartTimeRef.current = startAt + audioBuffer.duration;

      activeSourcesRef.current.add(source);
      setStatus('speaking');

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        if (activeSourcesRef.current.size === 0) {
          setStatus((prev) => (prev === 'speaking' ? 'ready' : prev));
        }
      };

      source.start(startAt);
    },
    [],
  );

  const cleanupSession = useCallback(() => {
    flushCompletedTurn();
    stopQueuedOutputAudio();

    if (processorRef.current) {
      try {
        processorRef.current.onaudioprocess = null;
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch {}
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setMicLevel(0);
  }, [flushCompletedTurn, stopQueuedOutputAudio]);

  const startLiveSession = useCallback(
    async (voiceToUse: GeminiLiveVoiceId = selectedVoice) => {
      cleanupSession();
      setStatus('connecting');
      setErrorMessage(null);

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const outCtx = new AudioCtx({ sampleRate: 24000 });
        outputAudioCtxRef.current = outCtx;

        // Request microphone stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        const inCtx = new AudioCtx({ sampleRate: 16000 });
        inputAudioCtxRef.current = inCtx;

        const wsUrl = getWebSocketUrl('/api/live', token);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'init',
              voiceName: voiceToUse,
              contextData: aiContextRef.current,
              focusScopes: focusScopesRef.current,
            }),
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'ready') {
              setStatus('ready');
              return;
            }

            if (msg.type === 'input_transcript' && msg.text) {
              userTranscriptAccRef.current += msg.text;
              setLiveUserTranscript(userTranscriptAccRef.current.trim());
              return;
            }

            if (msg.type === 'output_transcript' && msg.text) {
              assistantTranscriptAccRef.current += msg.text;
              setLiveAssistantTranscript(assistantTranscriptAccRef.current.trim());
              return;
            }

            if (msg.type === 'text' && msg.text && !assistantTranscriptAccRef.current) {
              assistantTranscriptAccRef.current += msg.text;
              setLiveAssistantTranscript(assistantTranscriptAccRef.current.trim());
            }

            if (msg.audio) {
              scheduleOutputPcmChunk(msg.audio);
            }

            if (msg.interrupted) {
              stopQueuedOutputAudio();
              setStatus('ready');
            }

            if (msg.turnComplete) {
              flushCompletedTurn();
            }

            if (msg.type === 'error') {
              setErrorMessage(msg.error || 'Live voice session encountered an error.');
              setStatus('error');
            }
          } catch {}
        };

        ws.onerror = () => {
          setErrorMessage(
            'Unable to connect to the Gemini Live voice stream. Please check your connection and try again.',
          );
          setStatus('error');
        };

        ws.onclose = () => {
          setStatus((prev) => (prev === 'error' ? 'error' : 'closed'));
        };

        // Wire microphone PCM capture (16kHz 16-bit mono)
        const source = inCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const processor = inCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) {
            setMicLevel(0);
            return;
          }
          const rawChannel = e.inputBuffer.getChannelData(0);

          // Compute RMS level for visual feedback
          let sumSq = 0;
          for (let i = 0; i < rawChannel.length; i += 4) {
            sumSq += rawChannel[i] * rawChannel[i];
          }
          const rms = Math.sqrt(sumSq / (rawChannel.length / 4));
          setMicLevel(Math.min(1, rms * 6));

          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

          const samples16k = downsampleTo16kHz(rawChannel, inCtx.sampleRate);
          const base64Audio = float32ToPcm16Base64(samples16k);
          wsRef.current.send(JSON.stringify({ audio: base64Audio }));
        };

        source.connect(processor);
        processor.connect(inCtx.destination);
      } catch (err: any) {
        const isPermDenied =
          err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setErrorMessage(
          isPermDenied
            ? 'Microphone permission was denied. Please allow microphone access in your browser to talk with Spex.'
            : err?.message || 'Could not start microphone or Gemini Live session.',
        );
        setStatus('error');
      }
    },
    [cleanupSession, flushCompletedTurn, scheduleOutputPcmChunk, selectedVoice, stopQueuedOutputAudio, token],
  );

  useEffect(() => {
    if (isOpen) {
      startLiveSession(selectedVoice);
    } else {
      cleanupSession();
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen]);

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) setMicLevel(0);
      return next;
    });
  };

  const handleToggleSpeaker = () => {
    setIsSpeakerMuted((prev) => {
      const next = !prev;
      isSpeakerMutedRef.current = next;
      if (next) stopQueuedOutputAudio();
      return next;
    });
  };

  const handleVoiceChange = (voiceId: GeminiLiveVoiceId) => {
    setSelectedVoice(voiceId);
    try {
      localStorage.setItem('truespend_live_voice', voiceId);
    } catch {}
    startLiveSession(voiceId);
  };

  const handleSendQuickPrompt = (prompt: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    stopQueuedOutputAudio();
    userTranscriptAccRef.current = prompt;
    setLiveUserTranscript(prompt);
    wsRef.current.send(JSON.stringify({ type: 'text', text: prompt }));
  };

  const handleClose = () => {
    cleanupSession();
    onClose();
  };

  if (!isOpen) return null;

  const isSpeaking = status === 'speaking';
  const isListeningActive = status === 'ready' && !isMuted && micLevel > 0.04;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <AudioLines className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                Spex Live Voice Conversation
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Real-time bidirectional voice powered by Gemini Live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {GEMINI_LIVE_VOICES.map((voice) => (
              <button
                key={voice.id}
                type="button"
                onClick={() => handleVoiceChange(voice.id)}
                title={`${voice.label} (${voice.tone})`}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-colors border',
                  selectedVoice === voice.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white',
                )}
              >
                {voice.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Visualizer & Avatar Stage */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center bg-gray-50/60 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800">
          <div className="relative flex items-center justify-center">
            <div
              className={cn(
                'rounded-full p-2 transition-transform duration-150 border',
                isSpeaking
                  ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 scale-105'
                  : isListeningActive
                    ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 scale-105'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900',
              )}
            >
              <SpexAvatar
                className="h-20 w-20"
                animated
                clickable={false}
                state={
                  status === 'connecting'
                    ? 'running'
                    : isSpeaking
                      ? 'waving'
                      : isListeningActive
                        ? 'waiting'
                        : 'idle'
                }
              />
            </div>
          </div>

          {/* Live Audio Waveform Bars */}
          <div className="mt-4 h-7 flex items-center justify-center gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((barIdx) => {
              const centerDist = Math.abs(4 - barIdx);
              const baseHeight = 6;
              const dynamicBoost = isSpeaking
                ? 14 - centerDist * 2
                : isMuted
                  ? 0
                  : Math.max(0, micLevel * 22 - centerDist * 2.5);
              const heightPx = Math.min(26, Math.max(baseHeight, baseHeight + dynamicBoost));

              return (
                <span
                  key={barIdx}
                  className={cn(
                    'w-1 rounded-full transition-all duration-100',
                    isSpeaking
                      ? 'bg-indigo-600 dark:bg-indigo-400'
                      : isListeningActive
                        ? 'bg-emerald-500 dark:bg-emerald-400'
                        : 'bg-gray-300 dark:bg-gray-700',
                  )}
                  style={{ height: `${heightPx}px` }}
                />
              );
            })}
          </div>

          <p className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200">
            {status === 'connecting' && 'Connecting to Gemini Live voice stream…'}
            {status === 'ready' &&
              (isMuted
                ? 'Microphone muted — tap Unmute to speak'
                : 'Listening — speak naturally with Spex')}
            {status === 'speaking' && 'Spex is speaking — talk anytime to interrupt'}
            {status === 'error' && 'Voice connection interrupted'}
            {status === 'closed' && 'Voice session ended'}
          </p>

          {errorMessage && (
            <div className="mt-3 w-full rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-left flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => startLiveSession(selectedVoice)}
                  className="mt-1.5 inline-flex items-center gap-1 font-semibold underline"
                >
                  <RefreshCw className="w-3 h-3" /> Reconnect Live Session
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Transcript & Quick Starters Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-2.5 min-h-[150px] max-h-[240px]">
          {history.length === 0 && !liveUserTranscript && !liveAssistantTranscript ? (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Say anything or tap a starter
              </p>
              <div className="space-y-1.5">
                {LIVE_QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={status !== 'ready' && status !== 'speaking'}
                    onClick={() => handleSendQuickPrompt(prompt)}
                    className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 hover:border-indigo-300 dark:hover:border-indigo-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {history.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-xl px-3 py-2 text-xs leading-relaxed',
                    item.role === 'user'
                      ? 'bg-indigo-600 text-white ml-8'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 mr-8',
                  )}
                >
                  <span className="block text-[10px] font-semibold opacity-75 mb-0.5">
                    {item.role === 'user' ? 'You' : 'Spex'}
                  </span>
                  {item.text}
                </div>
              ))}

              {liveUserTranscript && (
                <div className="rounded-xl px-3 py-2 text-xs leading-relaxed bg-indigo-600/90 text-white ml-8">
                  <span className="block text-[10px] font-semibold opacity-75 mb-0.5">
                    You (speaking…)
                  </span>
                  {liveUserTranscript}
                </div>
              )}

              {liveAssistantTranscript && (
                <div className="rounded-xl px-3 py-2 text-xs leading-relaxed bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 mr-8 border border-indigo-200/60 dark:border-indigo-800/60">
                  <span className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5">
                    Spex (live)
                  </span>
                  {liveAssistantTranscript}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-colors',
                isMuted
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700',
              )}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSpeaker}
              title={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                isSpeakerMuted
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              )}
            >
              {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {isSpeaking && (
              <button
                type="button"
                onClick={() => {
                  stopQueuedOutputAudio();
                  setStatus('ready');
                }}
                title="Interrupt Spex"
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold transition-colors shadow-2xs"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Live</span>
          </button>
        </div>
      </div>
    </div>
  );
};
