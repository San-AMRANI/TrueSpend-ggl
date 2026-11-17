import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWavBytesFromPcm16,
  bytesToBase64,
  compactLiveContext,
  concatUint8Arrays,
  decodeBase64AudioToPcmFloat32,
  float32ToPcm16Bytes,
  isJwtTokenExpiringSoon,
  parseSampleRateFromMimeType,
  parseSseEventChunk,
  selectLiveTransport,
  shouldFallbackFromWebSocketToSse,
} from '../src/lib/liveVoiceHelpers.js';

test('selectLiveTransport routes Vercel/serverless and null capabilities to SSE', () => {
  assert.equal(
    selectLiveTransport({
      websocketSupported: false,
      sseVoiceSupported: true,
      recommendedTransport: 'sse',
    }),
    'sse',
  );
  assert.equal(selectLiveTransport(null), 'sse');
  assert.equal(
    selectLiveTransport({
      websocketSupported: true,
      sseVoiceSupported: true,
      recommendedTransport: 'websocket',
    }),
    'websocket',
  );
  assert.equal(
    selectLiveTransport(
      {
        websocketSupported: true,
        sseVoiceSupported: true,
        recommendedTransport: 'websocket',
      },
      true,
    ),
    'sse',
  );
});

test('shouldFallbackFromWebSocketToSse triggers only on pre-ready non-manual drops', () => {
  assert.equal(
    shouldFallbackFromWebSocketToSse({
      wasEverReady: false,
      manuallyClosed: false,
      sseVoiceSupported: true,
    }),
    true,
  );
  assert.equal(
    shouldFallbackFromWebSocketToSse({
      wasEverReady: true,
      manuallyClosed: false,
      sseVoiceSupported: true,
    }),
    false,
  );
  assert.equal(
    shouldFallbackFromWebSocketToSse({
      wasEverReady: false,
      manuallyClosed: true,
      sseVoiceSupported: true,
    }),
    false,
  );
});

test('isJwtTokenExpiringSoon detects expired or near-expiry JWT timestamps', () => {
  const now = 1_700_000_000_000;
  assert.equal(isJwtTokenExpiringSoon(now - 5_000, now), true);
  assert.equal(isJwtTokenExpiringSoon(now + 10_000, now, 20_000), true);
  assert.equal(isJwtTokenExpiringSoon(now + 120_000, now, 20_000), false);
  assert.equal(isJwtTokenExpiringSoon(null, now), false);
});

test('parseSseEventChunk parses split CRLF/LF SSE frames cleanly and preserves trailing remainder', () => {
  const chunk1 = 'data: {"type":"ready","transport":"sse"}\r\n\r\ndata: {"type":"output_transcript",';
  const res1 = parseSseEventChunk(chunk1);
  assert.equal(res1.events.length, 1);
  assert.equal(res1.events[0].type, 'ready');
  assert.equal(res1.events[0].transport, 'sse');
  assert.equal(res1.remainder, 'data: {"type":"output_transcript",');

  const chunk2 = res1.remainder + '"text":"Hello!"}\n\ndata: [DONE]\n\n';
  const res2 = parseSseEventChunk(chunk2);
  assert.equal(res2.events.length, 1);
  assert.equal(res2.events[0].type, 'output_transcript');
  assert.equal(res2.events[0].text, 'Hello!');
  assert.equal(res2.remainder, '');
});

test('buildWavBytesFromPcm16 wraps 16kHz PCM16 bytes in a valid 44-byte RIFF/WAVE header', () => {
  const pcm1 = float32ToPcm16Bytes(new Float32Array([0, 0.5, -0.5, 1.5, -1.5]));
  const pcm2 = float32ToPcm16Bytes(new Float32Array([0.25]));
  const merged = concatUint8Arrays([pcm1, pcm2]);
  assert.equal(merged.byteLength, 12);

  const wav = buildWavBytesFromPcm16(merged, 16000, 1);
  assert.equal(wav.byteLength, 44 + 12);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), 'WAVE');
  assert.equal(String.fromCharCode(...wav.slice(36, 40)), 'data');

  const view = new DataView(wav.buffer);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint32(40, true), 12);
  // Clamped +1.5 -> 32767, -1.5 -> -32768
  assert.equal(view.getInt16(44 + 6, true), 32767);
  assert.equal(view.getInt16(44 + 8, true), -32768);
});

test('compactLiveContext bounds large context payloads cleanly to valid JSON within maxChars', () => {
  const largeTx = Array.from({ length: 200 }, (_, i) => ({
    id: `tx_${i}`,
    notes: `Grocery Merchant Transaction #${i} with extended memo details`,
    amount: 100 + i,
  }));
  const largeContext = {
    financialPeriod: { label: 'Cycle Nov' },
    kpis: { safeToSpend: 3420, emergencyBuffer: 5000 },
    currentPeriodTransactions: largeTx,
    allRecentTransactions: largeTx,
  };

  const compacted = compactLiveContext(largeContext, 3500);
  assert.ok(compacted.length <= 3500);
  const parsed = JSON.parse(compacted);
  assert.equal(parsed.financialPeriod.label, 'Cycle Nov');
  assert.equal(parsed.kpis.safeToSpend, 3420);
  assert.ok(Array.isArray(parsed.currentPeriodTransactions));
  assert.ok(parsed.currentPeriodTransactions.length < largeTx.length);
});

test('parseSampleRateFromMimeType extracts valid rates and falls back safely', () => {
  assert.equal(parseSampleRateFromMimeType('audio/pcm;rate=24000'), 24000);
  assert.equal(parseSampleRateFromMimeType('audio/l16; rate=16000', 24000), 16000);
  assert.equal(parseSampleRateFromMimeType('audio/wav', 24000), 24000);
  assert.equal(parseSampleRateFromMimeType(undefined, 24000), 24000);
});

test('decodeBase64AudioToPcmFloat32 decodes raw PCM16 and strips RIFF/WAVE headers cleanly', () => {
  const input = new Float32Array([0, 0.5, -0.5, 0.25]);
  const rawPcmBytes = float32ToPcm16Bytes(input);

  const rawDecoded = decodeBase64AudioToPcmFloat32(
    bytesToBase64(rawPcmBytes),
    24000,
    'audio/pcm;rate=24000',
  );
  assert.equal(rawDecoded.sampleRate, 24000);
  assert.equal(rawDecoded.samples.length, 4);
  assert.ok(Math.abs(rawDecoded.samples[1] - 0.5) < 0.001);
  assert.ok(Math.abs(rawDecoded.samples[2] + 0.5) < 0.001);

  const wavBytes = buildWavBytesFromPcm16(rawPcmBytes, 22050, 1);
  const wavDecoded = decodeBase64AudioToPcmFloat32(bytesToBase64(wavBytes), 24000, 'audio/wav');
  assert.equal(wavDecoded.sampleRate, 22050);
  assert.equal(wavDecoded.samples.length, 4);
  assert.ok(Math.abs(wavDecoded.samples[1] - 0.5) < 0.001);
  assert.ok(Math.abs(wavDecoded.samples[2] + 0.5) < 0.001);
});
