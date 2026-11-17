import type { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import jwt from 'jsonwebtoken';
import { gemini, MODEL_LIVE } from './GeminiClient.js';
import { getJwtSecret } from './SecurityCrypto.js';
import { compactLiveContext } from '../../src/lib/liveVoiceHelpers.js';

export const LIVE_VOICE_OPTIONS = ['Zephyr', 'Puck', 'Kore', 'Fenrir', 'Charon'] as const;
export type LiveVoiceName = (typeof LIVE_VOICE_OPTIONS)[number];

const MAX_LIVE_CONTEXT_CHARS = 24_000;
let liveWebSocketGatewayActive = false;

export function isLiveWebSocketGatewayActive(): boolean {
  return liveWebSocketGatewayActive && !process.env.VERCEL;
}

export function buildLiveVoiceSystemInstruction(contextData?: unknown, focusScopes?: string[]): string {
  const scopesLabel =
    Array.isArray(focusScopes) && focusScopes.length > 0 ? focusScopes.join(', ') : 'all';
  const serializedContext = compactLiveContext(contextData, MAX_LIVE_CONTEXT_CHARS);

  return `You are Spex, TrueSpend's real-time voice financial and investment strategist powered by Google Gemini Live.
You are speaking directly with the user in a live, natural voice conversation.

## VOICE CONVERSATION RULES
1. Speak naturally, warmly, and concisely — like a sharp personal CFO and portfolio manager on a live call.
2. NEVER output JSON schemas, code blocks, or Markdown table syntax in voice mode. Express numbers and comparisons naturally in spoken sentences.
3. Keep each spoken turn focused and conversational (typically 2 to 5 sentences unless the user asks for a deep walkthrough), and invite follow-up questions naturally.
4. Reference the user's real numbers accurately from the live snapshot below:
   - Primary currency is Moroccan Dirham (pronounce MAD as "dirhams" or "MAD").
   - For Binance & stock positions, mention both USD ($) and MAD where helpful.
   - Safe-to-Spend = Total Liquid Accounts minus Emergency Buffer minus Protected Investment Reserve minus Pending Debt Payables.
   - Active Data Focus Scope: [${scopesLabel.toUpperCase()}].

## USER LIVE FINANCIAL & PORTFOLIO SNAPSHOT
${serializedContext}`;
}

function verifySocketToken(req: IncomingMessage): { userId: string } | null {
  try {
    const urlObj = new URL(req.url || '/api/live', 'http://localhost');
    const queryToken = urlObj.searchParams.get('token');
    const authHeader = req.headers.authorization;
    const headerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = queryToken || headerToken;
    if (!token) return null;

    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (!decoded?.userId) return null;
    if (decoded.tokenType && decoded.tokenType !== 'access') return null;
    return { userId: String(decoded.userId) };
  } catch {
    return null;
  }
}

export function attachLiveVoiceGateway(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  liveWebSocketGatewayActive = true;

  server.on('upgrade', (req, socket, head) => {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      if (urlObj.pathname !== '/api/live' && urlObj.pathname !== '/live') {
        return;
      }

      const auth = verifySocketToken(req);
      if (!auth) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, auth);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let sessionPromise: Promise<any> | null = null;
    let activeSession: any = null;
    let isClosed = false;

    const heartbeatTimer = setInterval(() => {
      if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;
      try {
        clientWs.ping();
      } catch {}
    }, 25_000);

    const safeSend = (payload: Record<string, unknown>) => {
      if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;
      try {
        clientWs.send(JSON.stringify(payload));
      } catch {}
    };

    const closeGeminiSession = () => {
      const current = activeSession;
      activeSession = null;
      sessionPromise = null;
      if (current) {
        try {
          current.close?.();
        } catch {}
      }
    };

    const initLiveSession = (opts?: {
      voiceName?: string;
      contextData?: unknown;
      focusScopes?: string[];
    }) => {
      closeGeminiSession();

      if (!process.env.GEMINI_API_KEY) {
        safeSend({
          type: 'error',
          error:
            'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.',
        });
        return null;
      }

      const requestedVoice = opts?.voiceName || 'Zephyr';
      const validVoice: LiveVoiceName = LIVE_VOICE_OPTIONS.includes(requestedVoice as LiveVoiceName)
        ? (requestedVoice as LiveVoiceName)
        : 'Zephyr';

      const systemInstruction = buildLiveVoiceSystemInstruction(
        opts?.contextData,
        opts?.focusScopes,
      );

      let geminiLiveOpened = false;

      sessionPromise = gemini.live
        .connect({
          model: MODEL_LIVE,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: validVoice,
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              geminiLiveOpened = true;
              safeSend({
                type: 'ready',
                transport: 'websocket',
                model: MODEL_LIVE,
                voiceName: validVoice,
              });
            },
            onmessage: (message: LiveServerMessage) => {
              if (message.setupComplete) {
                safeSend({ type: 'setup_complete' });
              }

              const content = message.serverContent;
              if (!content) return;

              if (content.inputTranscription?.text) {
                safeSend({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                });
              }

              if (content.outputTranscription?.text) {
                safeSend({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                });
              }

              for (const part of content.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  safeSend({
                    type: 'audio',
                    audio: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                  });
                }
                if (part.text) {
                  safeSend({
                    type: 'text',
                    text: part.text,
                  });
                }
              }

              if (content.interrupted) {
                safeSend({
                  type: 'interrupted',
                  interrupted: true,
                });
              }

              if (content.turnComplete) {
                safeSend({
                  type: 'turn_complete',
                  turnComplete: true,
                });
              }
            },
            onerror: (err: any) => {
              const message =
                err?.message || err?.error?.message || 'Gemini Live connection error occurred.';
              console.error('[LiveVoiceGateway] Gemini Live error:', message);
              if (!geminiLiveOpened) {
                safeSend({
                  type: 'fallback_to_sse',
                  error: message,
                });
                return;
              }
              safeSend({
                type: 'error',
                error: message,
              });
            },
            onclose: () => {
              if (!isClosed) {
                safeSend({ type: 'session_closed' });
              }
            },
          },
        })
        .then((session) => {
          if (isClosed) {
            try {
              session.close?.();
            } catch {}
            return null;
          }
          activeSession = session;
          return session;
        })
        .catch((err: any) => {
          const msg =
            err?.message || 'Failed to establish Gemini Live voice session. Please try again.';
          console.error('[LiveVoiceGateway] Failed to connect to Gemini Live:', msg);
          if (!geminiLiveOpened) {
            safeSend({
              type: 'fallback_to_sse',
              error: msg,
            });
            return null;
          }
          safeSend({
            type: 'error',
            error: msg,
          });
          return null;
        });

      return sessionPromise;
    };

    clientWs.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'init') {
          initLiveSession({
            voiceName: msg.voiceName,
            contextData: msg.contextData,
            focusScopes: msg.focusScopes,
          });
          return;
        }

        if (!sessionPromise) {
          initLiveSession();
        }

        if (msg.audio || (msg.type === 'audio' && msg.data)) {
          const audioBase64 = msg.audio || msg.data;
          if (typeof audioBase64 !== 'string' || !audioBase64) return;
          sessionPromise?.then((session) => {
            if (!session) return;
            try {
              session.sendRealtimeInput({
                audio: {
                  data: audioBase64,
                  mimeType: 'audio/pcm;rate=16000',
                },
              });
            } catch (e: any) {
              console.warn('[LiveVoiceGateway] sendRealtimeInput audio error:', e?.message);
            }
          });
          return;
        }

        if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim()) {
          const promptText = msg.text.trim();
          sessionPromise?.then((session) => {
            if (!session) return;
            try {
              session.sendRealtimeInput({
                text: promptText,
              });
            } catch (e: any) {
              console.warn('[LiveVoiceGateway] sendRealtimeInput text error:', e?.message);
            }
          });
          return;
        }

        if (msg.type === 'ping') {
          safeSend({ type: 'pong' });
        }
      } catch (err: any) {
        console.warn('[LiveVoiceGateway] Invalid client message:', err?.message);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      clearInterval(heartbeatTimer);
      closeGeminiSession();
    });

    clientWs.on('error', () => {
      isClosed = true;
      clearInterval(heartbeatTimer);
      closeGeminiSession();
    });
  });

  return wss;
}
