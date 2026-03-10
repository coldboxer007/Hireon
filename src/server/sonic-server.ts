/**
 * Express + Socket.IO server — Amazon Nova 2 Sonic bidirectional proxy.
 * Fix: sessionReady is emitted AFTER the first response chunk arrives,
 *      guaranteeing the Bedrock stream is live before we tell the client.
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
  InvokeModelWithBidirectionalStreamInput,
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttp2Handler } from '@smithy/node-http-handler';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PORT   = parseInt(process.env.SONIC_PORT || '3001', 10);
const REGION = process.env.AWS_REGION || 'us-east-1';

// ── Audio config ───────────────────────────────────────────────────────────
const AudioInputConfig = {
  mediaType: 'audio/lpcm',
  sampleRateHertz: 16000,
  sampleSizeBits: 16,
  channelCount: 1,
  audioType: 'SPEECH',
  encoding: 'base64',
};
const AudioOutputConfig = {
  mediaType: 'audio/lpcm',
  sampleRateHertz: 24000,
  sampleSizeBits: 16,
  channelCount: 1,
  voiceId: 'matthew',
  encoding: 'base64',
  audioType: 'SPEECH',
};
const TextConfig = { mediaType: 'text/plain' };

// ── Session ────────────────────────────────────────────────────────────────
interface Session {
  queue: any[];
  resolve: (() => void) | null;    // wakes the async iterator
  closed: boolean;
  promptName: string;
  audioContentId: string;
  audioStarted: boolean;
}

function createSession(): Session {
  return {
    queue: [],
    resolve: null,
    closed: false,
    promptName: randomUUID(),
    audioContentId: randomUUID(),
    audioStarted: false,
  };
}

function pushEvent(s: Session, event: object) {
  s.queue.push(event);
  s.resolve?.();
  s.resolve = null;
}

function makeIterable(s: Session): AsyncIterable<InvokeModelWithBidirectionalStreamInput> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<InvokeModelWithBidirectionalStreamInput>> {
          while (s.queue.length === 0) {
            if (s.closed) return { done: true, value: undefined };
            await new Promise<void>(r => { s.resolve = r; });
          }
          const event = s.queue.shift()!;
          const bytes  = new TextEncoder().encode(JSON.stringify(event));
          return { done: false, value: { chunk: { bytes } } };
        },
      };
    },
  };
}

// ── Bedrock client ─────────────────────────────────────────────────────────
const bedrockClient = new BedrockRuntimeClient({
  region: REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  requestHandler: new NodeHttp2Handler({
    requestTimeout:          300_000,
    sessionTimeout:          300_000,
    disableConcurrentStreams: false,
    maxConcurrentStreams:     20,
  }),
});

// ── Express / Socket.IO ────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);
const io         = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8,
});

io.on('connection', (socket) => {
  console.log(`[sonic] +connect ${socket.id}`);
  let session: Session | null = null;

  // ── startSession ──────────────────────────────────────────────────────
  socket.on('startSession', async ({ systemPrompt }: { systemPrompt: string }) => {
    session = createSession();
    const s = session;

    // 1. sessionStart — turnDetectionConfiguration enables VAD-based turn-taking
    pushEvent(s, { event: { sessionStart: {
      inferenceConfiguration: { maxTokens: 1024, topP: 0.9, temperature: 0.7 },
      turnDetectionConfiguration: {
        endpointingSensitivity: 'HIGH',
      },
    }}});

    // 2. promptStart
    pushEvent(s, { event: { promptStart: {
      promptName: s.promptName,
      textOutputConfiguration:  TextConfig,
      audioOutputConfiguration: AudioOutputConfig,
    }}});

    // 3. system prompt block
    const sysContentId = randomUUID();
    pushEvent(s, { event: { contentStart: {
      promptName:           s.promptName,
      contentName:          sysContentId,
      type:                 'TEXT',
      interactive:          true,
      role:                 'SYSTEM',
      textInputConfiguration: TextConfig,
    }}});
    pushEvent(s, { event: { textInput: {
      promptName:  s.promptName,
      contentName: sysContentId,
      content:     systemPrompt,
    }}});
    pushEvent(s, { event: { contentEnd: { promptName: s.promptName, contentName: sysContentId } }});

    // 4. open audio content block (user voice)
    pushEvent(s, { event: { contentStart: {
      promptName:            s.promptName,
      contentName:           s.audioContentId,
      type:                  'AUDIO',
      interactive:           true,
      role:                  'USER',
      audioInputConfiguration: AudioInputConfig,
    }}});
    s.audioStarted = true;

    // 5. Launch stream — read responses, forward to browser
    let readyEmitted = false;
    (async () => {
      try {
        const response = await bedrockClient.send(
          new InvokeModelWithBidirectionalStreamCommand({
            modelId: 'amazon.nova-2-sonic-v1:0',
            body:    makeIterable(s),
          })
        );

        if (!response.body) { socket.emit('error', { message: 'No response body from Bedrock' }); return; }

        for await (const chunk of response.body) {
          const bytes = chunk?.chunk?.bytes;
          if (!bytes) continue;

          let json: any;
          try { json = JSON.parse(Buffer.from(bytes).toString('utf-8')); } catch { continue; }

          if (!('event' in json)) continue;
          const evt = json.event;

          // Emit sessionReady on first chunk so browser knows stream is alive
          if (!readyEmitted) {
            readyEmitted = true;
            socket.emit('sessionReady', { sessionId: randomUUID() });
            console.log(`[sonic] stream live → sessionReady`);
          }

          if ('contentStart' in evt)    socket.emit('contentStart',   evt.contentStart);
          else if ('textOutput'  in evt) socket.emit('textOutput',    evt.textOutput);
          else if ('audioOutput' in evt) socket.emit('audioOutput',   evt.audioOutput);
          else if ('contentEnd'  in evt) socket.emit('contentEnd',    evt.contentEnd);
          else if ('completionEnd' in evt) socket.emit('completionEnd', evt.completionEnd);
        }
      } catch (err: any) {
        console.error('[sonic] stream error:', err?.message || err);
        socket.emit('error', { message: err?.message || 'Stream error' });
      }
    })();

    console.log(`[sonic] session queued, waiting for Bedrock stream…`);
  });

  // ── audioChunk ────────────────────────────────────────────────────────
  socket.on('audioChunk', (base64: string) => {
    if (!session?.audioStarted) return;
    pushEvent(session, { event: { audioInput: {
      promptName:  session.promptName,
      contentName: session.audioContentId,
      content:     base64,
    }}});
  });

  // ── textInput ─────────────────────────────────────────────────────────
  socket.on('textInput', (text: string) => {
    if (!session) return;
    const id = randomUUID();
    pushEvent(session, { event: { contentStart: {
      promptName: session.promptName, contentName: id,
      type: 'TEXT', interactive: false, role: 'USER',
      textInputConfiguration: TextConfig,
    }}});
    pushEvent(session, { event: { textInput: { promptName: session.promptName, contentName: id, content: text }}});
    pushEvent(session, { event: { contentEnd:  { promptName: session.promptName, contentName: id }}});
  });

  // ── endSession / disconnect ────────────────────────────────────────────
  const closeSession = () => {
    if (!session) return;
    const s = session;
    session  = null;

    if (s.audioStarted) {
      pushEvent(s, { event: { contentEnd:  { promptName: s.promptName, contentName: s.audioContentId }}});
    }
    pushEvent(s, { event: { promptEnd:  { promptName: s.promptName }}});
    pushEvent(s, { event: { sessionEnd: {} }});
    // Let the iterator drain then close
    setTimeout(() => { s.closed = true; s.resolve?.(); }, 1000);
  };

  socket.on('endSession',  closeSession);
  socket.on('disconnect',  () => { console.log(`[sonic] -connect ${socket.id}`); closeSession(); });
});

httpServer.listen(PORT, () => {
  console.log(`[sonic] Nova 2 Sonic proxy → http://localhost:${PORT}`);
});
