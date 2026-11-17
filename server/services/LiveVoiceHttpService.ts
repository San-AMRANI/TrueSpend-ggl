import { LiveServerMessage, Modality, Type } from '@google/genai';
import {
  gemini,
  MODEL_FLASH_DEEP,
  MODEL_FLASH_FAST,
  MODEL_FLASH_LATEST,
  MODEL_FLASH_LITE,
  MODEL_FLASH_LITE_PREVIEW,
  MODEL_FLASH_TTS,
  MODEL_LIVE,
  MODEL_TTS,
  isModelQuotaExhausted,
  isModelUnavailable,
  markModelQuotaExhausted,
  markModelTemporaryOverload,
} from './GeminiClient.js';
import {
  LIVE_VOICE_OPTIONS,
  LiveVoiceName,
  buildLiveVoiceSystemInstruction,
} from './LiveVoiceGateway.js';
import { buildWavBytesFromPcm16, LiveSseEvent } from '../../src/lib/liveVoiceHelpers.js';

export interface LiveVoiceTurnInput {
  audioBase64?: string;
  audioMimeType?: string;
  text?: string;
  voiceName?: string;
  contextData?: unknown;
  focusScopes?: string[];
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  signal?: AbortSignal;
}

function stripWavHeaderIfPresent(buf: Buffer): Buffer {
  if (buf.length > 44 && buf.subarray(0, 4).toString('ascii') === 'RIFF') {
    const dataIdx = buf.indexOf(Buffer.from('data'));
    if (dataIdx !== -1 && dataIdx + 8 <= buf.length) {
      const pcmLen = buf.readUInt32LE(dataIdx + 4);
      const start = dataIdx + 8;
      return buf.subarray(start, Math.min(start + pcmLen, buf.length));
    }
    return buf.subarray(44);
  }
  return buf;
}

function normalizeVoiceName(voice?: string): LiveVoiceName {
  if (voice && LIVE_VOICE_OPTIONS.includes(voice as LiveVoiceName)) {
    return voice as LiveVoiceName;
  }
  return 'Zephyr';
}

function buildConversationTailInstruction(
  baseInstruction: string,
  history?: Array<{ role: 'user' | 'assistant'; text: string }>,
): string {
  if (!Array.isArray(history) || history.length === 0) return baseInstruction;
  const recent = history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'User' : 'Spex'}: ${String(h.text || '').trim().slice(0, 500)}`)
    .filter(Boolean);
  if (recent.length === 0) return baseInstruction;
  return `${baseInstruction}\n\n## RECENT CONVERSATION CONTEXT\n${recent.join('\n')}`;
}

async function tryGeminiLiveBurstTurn(
  params: {
    pcmBuffer?: Buffer;
    textPrompt?: string;
    voiceName: LiveVoiceName;
    systemInstruction: string;
    signal?: AbortSignal;
  },
  onEvent: (evt: LiveSseEvent) => void,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let emittedAnyOutput = false;
    let activeSession: any = null;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(turnTimeout);
      if (params.signal) {
        params.signal.removeEventListener('abort', onAbort);
      }
      if (activeSession) {
        try {
          activeSession.close?.();
        } catch {}
        activeSession = null;
      }
      resolve(ok);
    };

    const onAbort = () => {
      finish(true);
    };

    if (params.signal?.aborted) {
      resolve(true);
      return;
    }
    params.signal?.addEventListener('abort', onAbort, { once: true });

    const turnTimeout = setTimeout(() => {
      finish(emittedAnyOutput);
    }, 18_000);

    gemini.live
      .connect({
        model: MODEL_LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: params.voiceName,
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: params.systemInstruction,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (settled) return;
            const content = message.serverContent;
            if (!content) return;

            if (content.inputTranscription?.text) {
              onEvent({
                type: 'input_transcript',
                text: content.inputTranscription.text,
              });
            }

            if (content.outputTranscription?.text) {
              emittedAnyOutput = true;
              onEvent({
                type: 'output_transcript',
                text: content.outputTranscription.text,
              });
            }

            for (const part of content.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                emittedAnyOutput = true;
                onEvent({
                  type: 'audio',
                  audio: part.inlineData.data,
                  mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                });
              }
              if (part.text) {
                emittedAnyOutput = true;
                onEvent({
                  type: 'text',
                  text: part.text,
                });
              }
            }

            if (content.turnComplete) {
              onEvent({ type: 'turn_complete', turnComplete: true });
              finish(true);
            }
          },
          onerror: () => {
            finish(emittedAnyOutput);
          },
          onclose: () => {
            finish(emittedAnyOutput);
          },
        },
      })
      .then((session) => {
        if (settled || params.signal?.aborted) {
          try {
            session.close?.();
          } catch {}
          return;
        }
        activeSession = session;

        if (params.pcmBuffer && params.pcmBuffer.length > 0) {
          // Stream 16kHz PCM chunks cleanly (~16KB each), then signal end-of-speech
          const CHUNK_BYTES = 16_384;
          for (let offset = 0; offset < params.pcmBuffer.length; offset += CHUNK_BYTES) {
            const slice = params.pcmBuffer.subarray(
              offset,
              Math.min(offset + CHUNK_BYTES, params.pcmBuffer.length),
            );
            session.sendRealtimeInput({
              audio: {
                data: slice.toString('base64'),
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          }
          session.sendRealtimeInput({ audioStreamEnd: true });
        } else if (params.textPrompt) {
          session.sendRealtimeInput({ text: params.textPrompt });
        } else {
          finish(false);
        }
      })
      .catch(() => {
        finish(emittedAnyOutput);
      });
  });
}

async function synthesizeVoicePcm(text: string, voiceName: LiveVoiceName): Promise<Buffer | null> {
  const ttsModels = [MODEL_FLASH_TTS, MODEL_TTS].filter((m) => !isModelQuotaExhausted(m));
  for (const model of ttsModels) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: text.slice(0, 900),
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) continue;
      const rawBuf = Buffer.from(base64Audio, 'base64');
      return stripWavHeaderIfPresent(rawBuf);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (err?.status === 429 || msg.includes('quota') || msg.includes('resource_exhausted')) {
        markModelQuotaExhausted(model, 1000 * 60 * 60);
      }
    }
  }
  return null;
}

async function runHttpModelAndTtsFallback(
  params: {
    pcmBuffer?: Buffer;
    textPrompt?: string;
    voiceName: LiveVoiceName;
    systemInstruction: string;
    signal?: AbortSignal;
  },
  onEvent: (evt: LiveSseEvent) => void,
): Promise<void> {
  const parts: any[] = [];
  if (params.pcmBuffer && params.pcmBuffer.length > 0) {
    const wavBytes = buildWavBytesFromPcm16(new Uint8Array(params.pcmBuffer), 16000, 1);
    parts.push({
      inlineData: {
        mimeType: 'audio/wav',
        data: Buffer.from(wavBytes).toString('base64'),
      },
    });
    parts.push({
      text: 'Transcribe what the user said in this audio clip and reply concisely in natural spoken English (2-4 sentences). Return JSON with "userTranscript" and "spokenReply".',
    });
  } else if (params.textPrompt) {
    parts.push({
      text: `User message: ${params.textPrompt}\n\nReply concisely in natural spoken sentences (no markdown tables or code blocks). Return JSON with "userTranscript" and "spokenReply".`,
    });
  } else {
    throw new Error('Either spoken audio or a prompt is required.');
  }

  const allCandidates = [
    'gemini-4-hydrogen',
    MODEL_FLASH_LITE_PREVIEW,
    MODEL_FLASH_LITE,
    MODEL_FLASH_FAST,
    MODEL_FLASH_LATEST,
    MODEL_FLASH_DEEP,
  ];
  const available = allCandidates.filter((m) => !isModelUnavailable(m));
  const candidateModels = available.length > 0 ? available : allCandidates;

  let parsed: { userTranscript?: string; spokenReply?: string } | null = null;
  let lastError: any = null;

  for (const model of candidateModels) {
    if (params.signal?.aborted) return;
    try {
      const resp = await gemini.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              userTranscript: { type: Type.STRING },
              spokenReply: { type: Type.STRING },
            },
            required: ['spokenReply'],
          },
        },
      });
      const raw = (resp.text || '').trim();
      if (raw) {
        parsed = JSON.parse(raw);
        if (parsed?.spokenReply) break;
      }
    } catch (err: any) {
      lastError = err;
      const msgLower = String(err?.message || '').toLowerCase();
      if (err?.status === 429 || msgLower.includes('quota') || msgLower.includes('resource_exhausted')) {
        markModelQuotaExhausted(model, 1000 * 60 * 30);
      } else if (err?.status === 503 || msgLower.includes('503') || msgLower.includes('high demand') || msgLower.includes('unavailable')) {
        markModelTemporaryOverload(model, 1000 * 60 * 2);
      }
    }
  }

  if (!parsed?.spokenReply) {
    throw lastError || new Error('Failed to generate voice response.');
  }

  if (parsed.userTranscript && params.pcmBuffer) {
    onEvent({ type: 'input_transcript', text: parsed.userTranscript.trim() });
  }

  const spokenReply = parsed.spokenReply.trim();
  onEvent({ type: 'output_transcript', text: spokenReply });

  if (params.signal?.aborted) return;

  const pcmOut = await synthesizeVoicePcm(spokenReply, params.voiceName);
  if (pcmOut && pcmOut.length > 0 && !params.signal?.aborted) {
    const CHUNK_SIZE = 24_000;
    for (let offset = 0; offset < pcmOut.length; offset += CHUNK_SIZE) {
      const slice = pcmOut.subarray(offset, Math.min(offset + CHUNK_SIZE, pcmOut.length));
      onEvent({
        type: 'audio',
        audio: slice.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
      });
    }
  }

  onEvent({ type: 'turn_complete', turnComplete: true });
}

function formatFriendlyGeminiError(err: any): string {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return 'Unable to complete Gemini Live voice turn. Please try again.';
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const innerMsg = parsed?.error?.message;
      const status = parsed?.error?.status || parsed?.error?.code;
      if (innerMsg) {
        return status ? `${innerMsg} (${status})` : innerMsg;
      }
    } catch {}
  }
  return raw;
}

export async function streamLiveVoiceTurn(
  input: LiveVoiceTurnInput,
  onEvent: (evt: LiveSseEvent) => void,
): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    onEvent({
      type: 'error',
      error: 'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.',
    });
    return;
  }

  const voiceName = normalizeVoiceName(input.voiceName);
  const baseInstruction = buildLiveVoiceSystemInstruction(input.contextData, input.focusScopes);
  const systemInstruction = buildConversationTailInstruction(baseInstruction, input.history);

  let pcmBuffer: Buffer | undefined;
  if (typeof input.audioBase64 === 'string' && input.audioBase64.trim()) {
    const cleanB64 = input.audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
    const rawBuf = Buffer.from(cleanB64, 'base64');
    pcmBuffer = stripWavHeaderIfPresent(rawBuf);
  }

  const textPrompt =
    typeof input.text === 'string' && input.text.trim() ? input.text.trim() : undefined;

  if ((!pcmBuffer || pcmBuffer.length === 0) && !textPrompt) {
    onEvent({ type: 'error', error: 'Audio recording or text prompt is required.' });
    return;
  }

  onEvent({ type: 'ready', transport: 'sse', voiceName });

  // 1. Primary: low-latency Gemini Live burst session over SSE
  const liveOk = await tryGeminiLiveBurstTurn(
    {
      pcmBuffer,
      textPrompt,
      voiceName,
      systemInstruction,
      signal: input.signal,
    },
    onEvent,
  );

  if (liveOk || input.signal?.aborted) {
    return;
  }

  // 2. Fallback: multimodal audio understanding + 24kHz PCM TTS when Live socket is unavailable
  try {
    await runHttpModelAndTtsFallback(
      {
        pcmBuffer,
        textPrompt,
        voiceName,
        systemInstruction,
        signal: input.signal,
      },
      onEvent,
    );
  } catch (err: any) {
    onEvent({
      type: 'error',
      error: formatFriendlyGeminiError(err),
    });
  }
}
