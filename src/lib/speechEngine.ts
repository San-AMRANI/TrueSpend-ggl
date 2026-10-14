/**
 * Robust Client-Side Speech & Audio Engine for TrueSpend
 *
 * Solves:
 * 1. Chromium 15-second cutoff / freeze bug by chunking text into natural sentences
 *    and maintaining a periodic keep-alive heartbeat (pause/resume).
 * 2. V8 Garbage Collection bug during SpeechSynthesisUtterance playback by retaining
 *    active utterance references in a global registry.
 * 3. Base64 audio memory and buffer cutoff by streaming via Blob Object URLs
 *    instead of massive data: URIs.
 * 4. Automatic text cleaning (stripping markdown tables, symbols, converting currencies
 *    like MAD to dirhams, and natural phrasing).
 */

// Global registry to prevent V8 garbage collector from terminating speech mid-utterance
declare global {
  interface Window {
    __truespend_active_utterances?: SpeechSynthesisUtterance[];
    __truespend_speech_heartbeat?: any;
  }
}

if (typeof window !== 'undefined') {
  window.__truespend_active_utterances = window.__truespend_active_utterances || [];
}

/**
 * Sanitizes markdown, markdown tables, financial symbols, and emojis for natural spoken text.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove image tags
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Convert links [Text](url) -> Text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove table divider rows (e.g. |---|---|)
    .replace(/^\|?[\s-:]+\|[\s-:]+\|?$/gm, '')
    // Convert table rows into natural spoken phrasing: | Groceries | 1200 MAD | Within budget |
    .replace(/\|([^\n|]+)\|([^\n|]+)\|([^\n|]+)?\|?/g, (_match, c1, c2, c3) => {
      const p1 = (c1 || '').trim();
      const p2 = (c2 || '').trim();
      const p3 = (c3 || '').trim();
      if (!p1 || p1.includes('---')) return '';
      return `${p1}: ${p2}${p3 ? `, ${p3}` : ''}. `;
    })
    // Remove single stray pipes
    .replace(/\|/g, ', ')
    // Remove headers (#, ##, ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points at line starts
    .replace(/^[-*•]\s+/gm, '')
    // Remove bold, italic, strikethrough, blockquotes
    .replace(/[*_~>]/g, '')
    // Replace currency codes so TTS doesn't say "mad" (angry) or spell M-A-D
    .replace(/\bMAD\b/gi, 'dirhams')
    // Replace math symbols with spoken words
    .replace(/\+/g, 'plus ')
    .replace(/(?<=\s)-(?=\d)/g, 'minus ')
    // Strip emojis and miscellaneous symbols
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    // Normalize punctuation and whitespace
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])\1+/g, '$1')
    .trim();
}

/**
 * Splits text into small, natural spoken chunks (<= 160 chars) to prevent
 * Chromium's 15-second SpeechSynthesis timeout and audio stutter.
 */
export function splitIntoSpeechChunks(text: string, maxChunkLength = 160): string[] {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkLength) return [cleaned];

  // Match sentences ending in punctuation or end-of-string
  const rawSegments = cleaned.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleaned];
  const chunks: string[] = [];
  let current = '';

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    if (trimmed.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      // Sub-divide by commas, semicolons, colons or dashes
      const subParts = trimmed.match(/[^,;:—]+[,;:—]+|[^,;:—]+$/g) || [trimmed];
      for (const sub of subParts) {
        const subTrimmed = sub.trim();
        if (!subTrimmed) continue;
        if ((current + ' ' + subTrimmed).trim().length <= maxChunkLength) {
          current = (current + ' ' + subTrimmed).trim();
        } else {
          if (current) chunks.push(current);
          current = subTrimmed;
        }
      }
    } else if ((current + ' ' + trimmed).trim().length <= maxChunkLength) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      current = trimmed;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Plays base64 WAV or audio via Blob Object URLs (defeating data URI length and buffer limits).
 */
export function playAudioBlob(
  base64Audio: string,
  mimeType: string = 'audio/wav',
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): { stop: () => void; audio: HTMLAudioElement } {
  let cleanedUp = false;
  let objectUrl = '';

  try {
    const binaryString = window.atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
    objectUrl = URL.createObjectURL(blob);
  } catch (err) {
    options?.onError?.(err);
    const dummyAudio = new Audio();
    return { stop: () => {}, audio: dummyAudio };
  }

  const audio = new Audio(objectUrl);

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
    }
  };

  audio.onended = () => {
    cleanup();
    options?.onEnd?.();
  };

  audio.onerror = (e) => {
    cleanup();
    options?.onError?.(e);
  };

  audio
    .play()
    .then(() => options?.onStart?.())
    .catch((err) => {
      cleanup();
      options?.onError?.(err);
    });

  return {
    audio,
    stop: () => {
      cleanup();
      options?.onEnd?.();
    },
  };
}

/**
 * Rock-solid browser SpeechSynthesis player with chunk chaining, GC protection,
 * and Chrome keep-alive heartbeat.
 */
export function playBrowserSpeech(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onError?.(new Error('SpeechSynthesis not supported'));
    return () => {};
  }

  // Cancel any ongoing speech and clear heartbeats
  window.speechSynthesis.cancel();
  if (window.__truespend_speech_heartbeat) {
    clearInterval(window.__truespend_speech_heartbeat);
    window.__truespend_speech_heartbeat = null;
  }
  window.__truespend_active_utterances = [];

  const chunks = splitIntoSpeechChunks(text, 160);
  if (chunks.length === 0) {
    options?.onEnd?.();
    return () => {};
  }

  let currentIndex = 0;
  let isCancelled = false;

  const stop = () => {
    if (isCancelled) return;
    isCancelled = true;
    if (window.__truespend_speech_heartbeat) {
      clearInterval(window.__truespend_speech_heartbeat);
      window.__truespend_speech_heartbeat = null;
    }
    window.__truespend_active_utterances = [];
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    options?.onEnd?.();
  };

  // Heartbeat to prevent Chrome's internal ~15s pause bug
  window.__truespend_speech_heartbeat = setInterval(() => {
    if (isCancelled) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 8000);

  const speakNext = () => {
    if (isCancelled) return;

    if (currentIndex >= chunks.length) {
      // All chunks finished successfully
      if (window.__truespend_speech_heartbeat) {
        clearInterval(window.__truespend_speech_heartbeat);
        window.__truespend_speech_heartbeat = null;
      }
      window.__truespend_active_utterances = [];
      options?.onEnd?.();
      return;
    }

    const chunk = chunks[currentIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;

    // Retain in global array to prevent V8 GC from killing utterance mid-speech
    window.__truespend_active_utterances?.push(utterance);

    utterance.onstart = () => {
      if (currentIndex === 0) {
        options?.onStart?.();
      }
    };

    utterance.onend = () => {
      if (isCancelled) return;
      currentIndex++;
      speakNext();
    };

    utterance.onerror = (event) => {
      if (isCancelled) return;
      // 'interrupted' or 'canceled' are expected when user stops
      if (event.error === 'interrupted' || event.error === 'canceled') {
        stop();
        return;
      }
      console.warn('SpeechSynthesis chunk warning:', event.error, chunk);
      // Skip failed chunk and proceed to keep speaking the rest
      currentIndex++;
      speakNext();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Error calling speechSynthesis.speak:', err);
      stop();
    }
  };

  speakNext();
  return stop;
}
