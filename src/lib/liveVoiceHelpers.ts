export type LiveTransportMode = 'websocket' | 'sse';

export interface LiveCapabilitiesResponse {
  websocketSupported: boolean;
  sseVoiceSupported: boolean;
  geminiConfigured: boolean;
  recommendedTransport: LiveTransportMode;
  wsPath: string;
  sseTurnPath: string;
  voices?: readonly string[];
}

export interface LiveSseEvent {
  type:
    | 'ready'
    | 'setup_complete'
    | 'fallback_to_sse'
    | 'input_transcript'
    | 'output_transcript'
    | 'text'
    | 'audio'
    | 'interrupted'
    | 'turn_complete'
    | 'session_closed'
    | 'error'
    | 'pong';
  audio?: string;
  mimeType?: string;
  text?: string;
  error?: string;
  model?: string;
  voiceName?: string;
  transport?: LiveTransportMode;
  interrupted?: boolean;
  turnComplete?: boolean;
}

export function selectLiveTransport(
  capabilities: Pick<LiveCapabilitiesResponse, 'websocketSupported' | 'sseVoiceSupported' | 'recommendedTransport'> | null | undefined,
  forceSse = false,
): LiveTransportMode {
  if (forceSse) return 'sse';
  if (!capabilities) return 'sse';
  if (capabilities.websocketSupported && capabilities.recommendedTransport !== 'sse') {
    return 'websocket';
  }
  return 'sse';
}

export function shouldFallbackFromWebSocketToSse(params: {
  wasEverReady: boolean;
  manuallyClosed: boolean;
  sseVoiceSupported?: boolean;
}): boolean {
  if (params.manuallyClosed) return false;
  if (params.sseVoiceSupported === false) return false;
  return !params.wasEverReady;
}

export function isJwtTokenExpiringSoon(
  expirationMs: number | null,
  nowMs: number = Date.now(),
  bufferMs: number = 20_000,
): boolean {
  if (!expirationMs) return false;
  return expirationMs <= nowMs + bufferMs;
}

/**
 * Incrementally parses Server-Sent Events (`data: {...}\n\n`) from a chunked UTF-8 buffer.
 * Returns parsed JSON payloads and any unconsumed trailing partial frame.
 */
export function parseSseEventChunk(buffer: string): {
  events: LiveSseEvent[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const frames = normalized.split('\n\n');
  const remainder = frames.pop() ?? '';
  const events: LiveSseEvent[] = [];

  for (const frame of frames) {
    const lines = frame.split('\n');
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) continue;
    const rawJson = dataLines.join('\n').trim();
    if (!rawJson || rawJson === '[DONE]') continue;
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
        events.push(parsed as LiveSseEvent);
      }
    } catch {
      // Ignore malformed SSE event payload
    }
  }

  return { events, remainder };
}

/**
 * Wraps raw 16-bit signed little-endian mono PCM bytes into a standard 44-byte RIFF/WAVE byte array.
 */
export function buildWavBytesFromPcm16(
  pcmBytes: Uint8Array,
  sampleRate: number = 16000,
  numChannels: number = 1,
): Uint8Array {
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.byteLength;
  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      wav[offset + i] = str.charCodeAt(i);
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // AudioFormat = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  wav.set(pcmBytes, 44);

  return wav;
}

export function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.byteLength;
  }
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export function float32ToPcm16Bytes(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    view.setInt16(i * 2, int16, true);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Produces a bounded, valid JSON string for Live Voice system instructions without
 * cutting JSON syntax mid-object or overflowing WebSocket setup frames.
 */
export function compactLiveContext(contextData: unknown, maxChars: number = 24_000): string {
  if (!contextData || typeof contextData !== 'object') {
    return typeof contextData === 'string' && contextData.trim()
      ? contextData.slice(0, maxChars)
      : 'No financial snapshot provided yet.';
  }

  try {
    const direct = JSON.stringify(contextData);
    if (direct.length <= maxChars) return direct;

    const record = contextData as Record<string, unknown>;
    const compacted: Record<string, unknown> = {};
    const arrayLimits: Record<string, number> = {
      currentPeriodTransactions: 20,
      allRecentTransactions: 15,
      recentTransactions: 15,
      positions: 20,
      recentTrades: 12,
      manualStockOrders: 12,
      wallets: 15,
      categoryBudgets: 20,
      debts: 15,
      goals: 15,
      subscriptions: 15,
    };

    for (const [key, val] of Object.entries(record)) {
      if (Array.isArray(val)) {
        const limit = arrayLimits[key] ?? 12;
        compacted[key] = val.slice(0, limit);
      } else {
        compacted[key] = val;
      }
    }

    const firstPass = JSON.stringify(compacted);
    if (firstPass.length <= maxChars) return firstPass;

    // Second pass: tighten array slices and drop verbose sub-arrays
    for (const key of Object.keys(compacted)) {
      const val = compacted[key];
      if (Array.isArray(val)) {
        compacted[key] = val.slice(0, 6);
      }
      if (JSON.stringify(compacted).length <= maxChars) break;
    }

    const secondPass = JSON.stringify(compacted);
    if (secondPass.length <= maxChars) return secondPass;

    // Final deterministic priority pick
    const priorityKeys = [
      'financialPeriod',
      'kpis',
      'safeToSpend',
      'wallets',
      'stockPortfolio',
      'categoryBudgets',
      'debts',
      'goals',
      'subscriptions',
      'currentPeriodTransactions',
    ];
    const slim: Record<string, unknown> = {};
    for (const key of priorityKeys) {
      if (key in compacted) {
        slim[key] = compacted[key];
      }
    }
    const slimJson = JSON.stringify(slim);
    return slimJson.length <= maxChars ? slimJson : `${slimJson.slice(0, maxChars - 16)}...`;
  } catch {
    return 'No financial snapshot provided yet.';
  }
}
