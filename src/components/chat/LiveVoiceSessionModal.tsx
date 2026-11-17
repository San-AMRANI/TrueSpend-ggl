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
  Send,
} from 'lucide-react';
import { SpexAvatar } from '../common/SpexAvatar';
import { cn } from '../../lib/utils';
import { getApiUrl, getWebSocketUrl, isNativePlatform } from '../../lib/capacitorBridge';
import {
  apiClient,
  getApiAccessToken,
  getJwtExpirationMs,
  refreshAccessSession,
} from '../../services/api/apiClient';
import {
  LiveCapabilitiesResponse,
  LiveSseEvent,
  LiveTransportMode,
  bytesToBase64,
  compactLiveContext,
  concatUint8Arrays,
  float32ToPcm16Bytes,
  isJwtTokenExpiringSoon,
  parseSseEventChunk,
  selectLiveTransport,
  shouldFallbackFromWebSocketToSse,
} from '../../lib/liveVoiceHelpers';

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

const VAD_SPEECH_RMS_THRESHOLD = 0.022;
const VAD_SILENCE_MS = 950;
const VAD_MAX_UTTERANCE_MS = 16_000;
const VAD_PRE_ROLL_CHUNKS = 5;

export const LiveVoiceSessionModal: React.FC<LiveVoiceSessionModalProps> = ({
  isOpen,
  onClose,
  token,
  aiContext,
  focusScopes,
  onTurnCommitted,
}) => {
  const [status, setStatus] = useState<'connecting' | 'ready' | 'processing' | 'speaking' | 'error' | 'closed'>(
    'connecting',
  );
  const [transportMode, setTransportMode] = useState<LiveTransportMode>('websocket');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isVadSpeaking, setIsVadSpeaking] = useState(false);
  const [typedPrompt, setTypedPrompt] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<GeminiLiveVoiceId>(() => {
    const saved = localStorage.getItem('truespend_live_voice') as GeminiLiveVoiceId | null;
    if (saved && GEMINI_LIVE_VOICES.some((v) => v.id === saved)) return saved;
    return 'Zephyr';
  });
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
  const [history, setHistory] = useState<LiveTurnEntry[]>([]);
  const [micLevel, setMicLevel] = useState(0);

  // Refs for real-time audio & WebSocket/SSE callbacks (prevent stale closures & StrictMode races)
  const attemptIdRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const sseAbortRef = useRef<AbortController | null>(null);
  const transportModeRef = useRef<LiveTransportMode>('websocket');
  const isSessionReadyRef = useRef<boolean>(false);
  const activeVoiceRef = useRef<GeminiLiveVoiceId>(selectedVoice);
  const activeTokenRef = useRef<string | null>(token);
  const capabilitiesRef = useRef<LiveCapabilitiesResponse | null>(null);

  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef<boolean>(false);
  const isSpeakerMutedRef = useRef<boolean>(false);
  const isTurnBusyRef = useRef<boolean>(false);
  const userTranscriptAccRef = useRef<string>('');
  const assistantTranscriptAccRef = useRef<string>('');
  const historyRef = useRef<LiveTurnEntry[]>([]);
  const onTurnCommittedRef = useRef(onTurnCommitted);
  const aiContextRef = useRef(aiContext);
  const focusScopesRef = useRef(focusScopes);

  // VAD buffers for SSE voice turn capture
  const preRollChunksRef = useRef<Uint8Array[]>([]);
  const speechChunksRef = useRef<Uint8Array[]>([]);
  const vadActiveRef = useRef<boolean>(false);
  const vadSpeechStartedAtRef = useRef<number>(0);
  const vadLastVoiceAtRef = useRef<number>(0);

  useEffect(() => {
    onTurnCommittedRef.current = onTurnCommitted;
  }, [onTurnCommitted]);

  useEffect(() => {
    aiContextRef.current = aiContext;
    focusScopesRef.current = focusScopes;
  }, [aiContext, focusScopes]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const resolveFreshToken = useCallback(async (): Promise<string | null> => {
    let candidate = getApiAccessToken() || token || activeTokenRef.current;
    const expMs = candidate ? getJwtExpirationMs(candidate) : null;
    if (!candidate || isJwtTokenExpiringSoon(expMs)) {
      const refreshed = await refreshAccessSession();
      if (refreshed.status === 'ok' && refreshed.token) {
        candidate = refreshed.token;
      }
    }
    activeTokenRef.current = candidate || null;
    return activeTokenRef.current;
  }, [token]);

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

  const scheduleOutputPcmChunk = useCallback((base64Pcm: string) => {
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
      if (activeSourcesRef.current.size === 0 && !isTurnBusyRef.current) {
        setStatus((prev) => (prev === 'speaking' ? 'ready' : prev));
      }
    };

    source.start(startAt);
  }, []);

  const handleServerEvent = useCallback(
    (msg: LiveSseEvent) => {
      if (msg.type === 'ready') {
        isSessionReadyRef.current = true;
        if (msg.transport) {
          transportModeRef.current = msg.transport;
          setTransportMode(msg.transport);
        }
        setStatus((prev) => (prev === 'speaking' ? 'speaking' : 'ready'));
        return;
      }

      if (msg.type === 'setup_complete' || msg.type === 'pong') {
        return;
      }

      if (msg.type === 'input_transcript' && msg.text) {
        userTranscriptAccRef.current = msg.text;
        setLiveUserTranscript(msg.text.trim());
        return;
      }

      if (msg.type === 'output_transcript' && msg.text) {
        assistantTranscriptAccRef.current +=
          (assistantTranscriptAccRef.current && !assistantTranscriptAccRef.current.endsWith(' ')
            ? ' '
            : '') + msg.text.trim();
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
        if (!isTurnBusyRef.current) {
          setStatus('ready');
        }
      }

      if (msg.turnComplete || msg.type === 'turn_complete') {
        flushCompletedTurn();
        if (activeSourcesRef.current.size === 0) {
          setStatus('ready');
        }
      }

      if (msg.type === 'error') {
        setErrorMessage(msg.error || 'Live voice session encountered an error.');
        if (transportModeRef.current === 'sse') {
          setStatus('ready');
        } else {
          setStatus('error');
        }
      }
    },
    [flushCompletedTurn, scheduleOutputPcmChunk, stopQueuedOutputAudio],
  );

  const resetVadState = useCallback(() => {
    vadActiveRef.current = false;
    speechChunksRef.current = [];
    preRollChunksRef.current = [];
    vadSpeechStartedAtRef.current = 0;
    vadLastVoiceAtRef.current = 0;
    setIsVadSpeaking(false);
  }, []);

  const cleanupSession = useCallback(
    (bumpAttempt = true) => {
      if (bumpAttempt) {
        attemptIdRef.current += 1;
      }
      isSessionReadyRef.current = false;
      isTurnBusyRef.current = false;
      resetVadState();
      flushCompletedTurn();
      stopQueuedOutputAudio();

      if (sseAbortRef.current) {
        try {
          sseAbortRef.current.abort();
        } catch {}
        sseAbortRef.current = null;
      }

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
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.onmessage = null;
          if (
            wsRef.current.readyState === WebSocket.OPEN ||
            wsRef.current.readyState === WebSocket.CONNECTING
          ) {
            wsRef.current.close();
          }
        } catch {}
        wsRef.current = null;
      }

      setMicLevel(0);
    },
    [flushCompletedTurn, resetVadState, stopQueuedOutputAudio],
  );

  const sendSseVoiceTurn = useCallback(
    async (payload: { audioBase64?: string; text?: string }) => {
      const myAttemptId = attemptIdRef.current;
      if (isTurnBusyRef.current) return;

      isTurnBusyRef.current = true;
      setErrorMessage(null);
      setStatus('processing');

      if (payload.text) {
        userTranscriptAccRef.current = payload.text;
        setLiveUserTranscript(payload.text);
      }

      const controller = new AbortController();
      sseAbortRef.current = controller;

      try {
        const freshToken = await resolveFreshToken();
        if (attemptIdRef.current !== myAttemptId) return;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (freshToken) {
          headers['Authorization'] = `Bearer ${freshToken}`;
        }
        if (isNativePlatform()) {
          headers['X-Client-Platform'] = 'capacitor';
        }

        const compactContext = compactLiveContext(aiContextRef.current, 18_000);
        const turnPath = capabilitiesRef.current?.sseTurnPath || '/api/chat/live-turn';

        const response = await fetch(getApiUrl(turnPath), {
          method: 'POST',
          credentials: 'include',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            audioBase64: payload.audioBase64,
            audioMimeType: payload.audioBase64 ? 'audio/pcm;rate=16000' : undefined,
            text: payload.text,
            voiceName: activeVoiceRef.current,
            contextData: compactContext,
            focusScopes: focusScopesRef.current,
            history: historyRef.current.slice(-6).map((h) => ({ role: h.role, text: h.text })),
          }),
        });

        if (!response.ok || !response.body) {
          const errPayload = await response.json().catch(() => ({}));
          throw new Error(
            errPayload.error || `Live voice request failed (${response.status})`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (attemptIdRef.current !== myAttemptId) {
            await reader.cancel().catch(() => {});
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseEventChunk(buffer);
          buffer = parsed.remainder;
          for (const evt of parsed.events) {
            handleServerEvent(evt);
          }
        }

        if (buffer.trim()) {
          const trailing = parseSseEventChunk(`${buffer}\n\n`);
          for (const evt of trailing.events) {
            handleServerEvent(evt);
          }
        }

        if (attemptIdRef.current === myAttemptId) {
          flushCompletedTurn();
          if (activeSourcesRef.current.size === 0) {
            setStatus((prev) => (prev === 'error' ? 'error' : 'ready'));
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || attemptIdRef.current !== myAttemptId) {
          return;
        }
        setErrorMessage(
          err?.message || 'Unable to process live voice response. Please try again.',
        );
        setStatus('error');
      } finally {
        if (sseAbortRef.current === controller) {
          sseAbortRef.current = null;
        }
        isTurnBusyRef.current = false;
      }
    },
    [flushCompletedTurn, handleServerEvent, resolveFreshToken],
  );

  const wireMicrophonePipeline = useCallback(
    (stream: MediaStream, inCtx: AudioContext, attemptId: number) => {
      const source = inCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (attemptIdRef.current !== attemptId) return;
        if (isMutedRef.current) {
          setMicLevel(0);
          if (vadActiveRef.current) resetVadState();
          return;
        }

        const rawChannel = e.inputBuffer.getChannelData(0);

        let sumSq = 0;
        for (let i = 0; i < rawChannel.length; i += 4) {
          sumSq += rawChannel[i] * rawChannel[i];
        }
        const rms = Math.sqrt(sumSq / (rawChannel.length / 4));
        setMicLevel(Math.min(1, rms * 6));

        const samples16k = downsampleTo16kHz(rawChannel, inCtx.sampleRate);
        const pcmBytes = float32ToPcm16Bytes(samples16k);

        if (transportModeRef.current === 'websocket') {
          if (
            !isSessionReadyRef.current ||
            !wsRef.current ||
            wsRef.current.readyState !== WebSocket.OPEN
          ) {
            return;
          }
          const base64Audio = bytesToBase64(pcmBytes);
          wsRef.current.send(JSON.stringify({ audio: base64Audio }));
          return;
        }

        // SSE hands-free VAD turn capture when running on serverless / HTTP fallback
        if (isTurnBusyRef.current || activeSourcesRef.current.size > 0) {
          return;
        }

        const now = Date.now();
        if (rms >= VAD_SPEECH_RMS_THRESHOLD) {
          if (!vadActiveRef.current) {
            vadActiveRef.current = true;
            vadSpeechStartedAtRef.current = now;
            speechChunksRef.current = [...preRollChunksRef.current];
            setIsVadSpeaking(true);
          }
          vadLastVoiceAtRef.current = now;
          speechChunksRef.current.push(pcmBytes);

          if (now - vadSpeechStartedAtRef.current >= VAD_MAX_UTTERANCE_MS) {
            const merged = concatUint8Arrays(speechChunksRef.current);
            resetVadState();
            if (merged.byteLength > 3200) {
              sendSseVoiceTurn({ audioBase64: bytesToBase64(merged) });
            }
          }
        } else if (vadActiveRef.current) {
          speechChunksRef.current.push(pcmBytes);
          if (now - vadLastVoiceAtRef.current >= VAD_SILENCE_MS) {
            const merged = concatUint8Arrays(speechChunksRef.current);
            resetVadState();
            if (merged.byteLength > 3200) {
              sendSseVoiceTurn({ audioBase64: bytesToBase64(merged) });
            }
          }
        } else {
          preRollChunksRef.current.push(pcmBytes);
          if (preRollChunksRef.current.length > VAD_PRE_ROLL_CHUNKS) {
            preRollChunksRef.current.shift();
          }
        }
      };

      source.connect(processor);
      processor.connect(inCtx.destination);
    },
    [resetVadState, sendSseVoiceTurn],
  );

  const activateSseTransport = useCallback(
    (attemptId: number) => {
      if (attemptIdRef.current !== attemptId) return;
      transportModeRef.current = 'sse';
      isSessionReadyRef.current = true;
      setTransportMode('sse');
      setErrorMessage(null);
      setStatus('ready');
    },
    [],
  );

  const startLiveSession = useCallback(
    async (voiceToUse: GeminiLiveVoiceId = selectedVoice, forceSse = false) => {
      cleanupSession(true);
      const myAttemptId = attemptIdRef.current;
      activeVoiceRef.current = voiceToUse;
      setStatus('connecting');
      setErrorMessage(null);
      setMicWarning(null);

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const outCtx = new AudioCtx({ sampleRate: 24000 });
        outputAudioCtxRef.current = outCtx;
        if (outCtx.state === 'suspended') {
          outCtx.resume().catch(() => {});
        }

        // 1. Ensure a non-expired access token before opening WebSocket or SSE
        const freshToken = await resolveFreshToken();
        if (attemptIdRef.current !== myAttemptId) return;

        // 2. Discover backend live transport capabilities (Vercel Serverless vs Node WebSocket)
        let capabilities: LiveCapabilitiesResponse | null = null;
        if (!forceSse) {
          try {
            capabilities = await apiClient.get<LiveCapabilitiesResponse>(
              '/api/chat/live-capabilities',
              freshToken,
            );
            capabilitiesRef.current = capabilities;
          } catch {
            capabilities = null;
          }
        }
        if (attemptIdRef.current !== myAttemptId) return;

        if (capabilities && capabilities.geminiConfigured === false) {
          setErrorMessage(
            'Gemini API key is not configured on the server. Please check Settings > Secrets.',
          );
          setStatus('error');
          return;
        }

        // 3. Acquire microphone cleanly (non-fatal if denied/absent — quick prompts still work)
        let micStream: MediaStream | null = null;
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } catch (micErr: any) {
            const isPermDenied =
              micErr?.name === 'NotAllowedError' || micErr?.name === 'PermissionDeniedError';
            setMicWarning(
              isPermDenied
                ? 'Microphone access is blocked. You can still tap starters or type below to talk with Spex.'
                : 'No active microphone detected. Use the quick starters or message box below to converse by voice.',
            );
          }
        } else {
          setMicWarning(
            'Microphone capture is unavailable in this browser context. Tap a starter or type below.',
          );
        }

        if (attemptIdRef.current !== myAttemptId) {
          micStream?.getTracks().forEach((t) => t.stop());
          return;
        }

        if (micStream) {
          mediaStreamRef.current = micStream;
          const inCtx = new AudioCtx({ sampleRate: 16000 });
          inputAudioCtxRef.current = inCtx;
          wireMicrophonePipeline(micStream, inCtx, myAttemptId);
        }

        // 4. Connect chosen transport (WebSocket on Node/Cloud Run, or SSE on Vercel Serverless)
        const chosenTransport = selectLiveTransport(capabilities, forceSse);

        if (chosenTransport === 'sse') {
          activateSseTransport(myAttemptId);
          return;
        }

        transportModeRef.current = 'websocket';
        setTransportMode('websocket');

        const wsPath = capabilities?.wsPath || '/api/live';
        const wsUrl = getWebSocketUrl(wsPath, freshToken);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let wasEverReady = false;
        let fallbackTriggered = false;

        const triggerFallbackToSse = () => {
          if (fallbackTriggered || attemptIdRef.current !== myAttemptId) return;
          fallbackTriggered = true;
          try {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close();
            }
          } catch {}
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
          activateSseTransport(myAttemptId);
        };

        ws.onopen = () => {
          if (attemptIdRef.current !== myAttemptId) {
            ws.close();
            return;
          }
          ws.send(
            JSON.stringify({
              type: 'init',
              voiceName: voiceToUse,
              contextData: compactLiveContext(aiContextRef.current, 24_000),
              focusScopes: focusScopesRef.current,
            }),
          );
        };

        ws.onmessage = (event) => {
          if (attemptIdRef.current !== myAttemptId) return;
          try {
            const msg = JSON.parse(event.data) as LiveSseEvent;
            if (msg.type === 'ready') {
              wasEverReady = true;
            }
            if (msg.type === 'fallback_to_sse') {
              triggerFallbackToSse();
              return;
            }
            if (
              msg.type === 'error' &&
              !String(msg.error || '').includes('GEMINI_API_KEY') &&
              shouldFallbackFromWebSocketToSse({
                wasEverReady,
                manuallyClosed: false,
                sseVoiceSupported: capabilities?.sseVoiceSupported ?? true,
              })
            ) {
              triggerFallbackToSse();
              return;
            }
            handleServerEvent(msg);
          } catch {}
        };

        ws.onerror = () => {
          if (attemptIdRef.current !== myAttemptId) return;
          if (
            shouldFallbackFromWebSocketToSse({
              wasEverReady,
              manuallyClosed: false,
              sseVoiceSupported: capabilities?.sseVoiceSupported ?? true,
            })
          ) {
            triggerFallbackToSse();
            return;
          }
          setErrorMessage(
            'Unable to connect to the Gemini Live voice stream. Please try reconnecting.',
          );
          setStatus('error');
        };

        ws.onclose = () => {
          if (attemptIdRef.current !== myAttemptId || fallbackTriggered) return;
          if (
            shouldFallbackFromWebSocketToSse({
              wasEverReady,
              manuallyClosed: false,
              sseVoiceSupported: capabilities?.sseVoiceSupported ?? true,
            })
          ) {
            triggerFallbackToSse();
            return;
          }
          setStatus((prev) => (prev === 'error' ? 'error' : 'closed'));
        };
      } catch (err: any) {
        if (attemptIdRef.current !== myAttemptId) return;
        setErrorMessage(
          err?.message || 'Could not start microphone or Gemini Live session.',
        );
        setStatus('error');
      }
    },
    [
      activateSseTransport,
      cleanupSession,
      handleServerEvent,
      resolveFreshToken,
      selectedVoice,
      wireMicrophonePipeline,
    ],
  );

  useEffect(() => {
    if (isOpen) {
      startLiveSession(selectedVoice);
    } else {
      cleanupSession(true);
    }
    return () => {
      cleanupSession(true);
    };
  }, [isOpen]);

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        setMicLevel(0);
        resetVadState();
      }
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
    activeVoiceRef.current = voiceId;
    try {
      localStorage.setItem('truespend_live_voice', voiceId);
    } catch {}
    startLiveSession(voiceId, transportModeRef.current === 'sse');
  };

  const handleSendTextTurn = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    if (outputAudioCtxRef.current?.state === 'suspended') {
      outputAudioCtxRef.current.resume().catch(() => {});
    }
    stopQueuedOutputAudio();

    if (transportModeRef.current === 'websocket') {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      userTranscriptAccRef.current = trimmed;
      setLiveUserTranscript(trimmed);
      wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed }));
      return;
    }

    sendSseVoiceTurn({ text: trimmed });
  };

  const handleInterrupt = () => {
    if (sseAbortRef.current) {
      try {
        sseAbortRef.current.abort();
      } catch {}
      sseAbortRef.current = null;
    }
    isTurnBusyRef.current = false;
    stopQueuedOutputAudio();
    setStatus('ready');
  };

  const handleClose = () => {
    cleanupSession(true);
    onClose();
  };

  if (!isOpen) return null;

  const isSpeaking = status === 'speaking';
  const isProcessing = status === 'processing';
  const isListeningActive =
    status === 'ready' && !isMuted && (isVadSpeaking || micLevel > 0.04);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <AudioLines className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">
                Spex Live Voice Conversation
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {transportMode === 'sse'
                  ? 'Gemini Live Voice Stream (HTTPS Streaming)'
                  : 'Real-time bidirectional voice powered by Gemini Live'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
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
        <div className="px-6 pt-5 pb-4 flex flex-col items-center text-center bg-gray-50/60 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800">
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
                  status === 'connecting' || isProcessing
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
          <div className="mt-3.5 h-7 flex items-center justify-center gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((barIdx) => {
              const centerDist = Math.abs(4 - barIdx);
              const baseHeight = 6;
              const dynamicBoost = isSpeaking
                ? 14 - centerDist * 2
                : isProcessing
                  ? 10 - centerDist * 1.5
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
                      : isProcessing
                        ? 'bg-amber-500 dark:bg-amber-400'
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
            {status === 'processing' && 'Spex is thinking & synthesizing voice…'}
            {status === 'ready' &&
              (isMuted
                ? 'Microphone muted — tap Unmute to speak or pick a starter'
                : isVadSpeaking
                  ? 'Listening to you — pause briefly when finished'
                  : 'Listening — speak naturally with Spex')}
            {status === 'speaking' && 'Spex is speaking — tap Stop anytime to interrupt'}
            {status === 'error' && 'Voice connection interrupted'}
            {status === 'closed' && 'Voice session ended'}
          </p>

          {micWarning && !errorMessage && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-1.5">
              {micWarning}
            </p>
          )}

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
        <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-2.5 min-h-[140px] max-h-[220px]">
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
                    onClick={() => handleSendTextTurn(prompt)}
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

        {/* Inline text prompt bar for silent environments / mic-off */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typedPrompt.trim()) return;
            handleSendTextTurn(typedPrompt);
            setTypedPrompt('');
          }}
          className="px-5 py-2.5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-2"
        >
          <input
            type="text"
            value={typedPrompt}
            onChange={(e) => setTypedPrompt(e.target.value)}
            placeholder="Or type a quick question for Spex to answer aloud…"
            disabled={status !== 'ready' && status !== 'speaking'}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!typedPrompt.trim() || (status !== 'ready' && status !== 'speaking')}
            aria-label="Send voice prompt"
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

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

            {(isSpeaking || isProcessing) && (
              <button
                type="button"
                onClick={handleInterrupt}
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
