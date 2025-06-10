import { createAnthropic } from '@ai-sdk/anthropic';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { messageHistory } from '@messages/history';
import { sendMessage } from '@messages/chat';
import { SSEOutput } from '@messages/output-strategies';
import { OutputStrategy } from '@messages/types';
import { toolRegistry } from './tools/index.js';
import logger from '@utils/logger';

// Load environment variables
dotenv.config();

const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';
const model = anthropic(MODEL);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public')); // For serving a simple web interface

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mcp: toolRegistry.getStatus(),
    tools: {
      total: toolRegistry.getToolNames().length,
      names: toolRegistry.getToolNames(),
    },
  };

  res.json(health);
});

// Create new chat session
app.post('/chat/session', (req: Request, res: Response) => {
  const sessionId = randomUUID();
  res.json({ sessionId });
});

// Get chat history
app.get('/chat/:sessionId/history', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const history = messageHistory.getHistory(sessionId);
  const pairCount = messageHistory.getMessagePairCount(sessionId);

  res.json({
    sessionId,
    messageCount: history.length,
    pairCount,
    messages: history,
  });
});

// Clear chat history
app.delete('/chat/:sessionId/history', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  messageHistory.clearHistory(sessionId);
  res.json({ message: 'History cleared', sessionId });
});

// Stream chat endpoint using Server-Sent Events (SSE)
app.post('/chat/:sessionId/stream', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required and must be a string' });
    return;
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  try {
    // Create SSE output strategy
    const sseOutput = new SSEOutput(res, sessionId);

    // Use the unified sendMessage function with SSE output
    await sendMessage(model, message, sessionId, sseOutput);
  } catch (error) {
    logger.error('Chat error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Only write error if response is still writable
    if (!res.destroyed && res.writable) {
      try {
        res.write(
          `event: error\ndata: ${JSON.stringify({ error: errorMessage })}\n\n`
        );
        res.end();
      } catch (writeError) {
        logger.error('Error writing to response stream:', writeError);
      }
    }
  }
});

// Non-streaming chat endpoint (for simple request/response)
app.post('/chat/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required and must be a string' });
    return;
  }

  try {
    // Create collect output strategy to gather full response
    const collectOutput = new (class implements OutputStrategy {
      private fullText = '';

      onChunk(text: string, accumulated: string): void {
        this.fullText = accumulated;
      }

      getFullText(): string {
        return this.fullText;
      }
    })();

    // Use the unified sendMessage function with collect output
    await sendMessage(model, message, sessionId, collectOutput);

    res.json({
      sessionId,
      response: (collectOutput as any).getFullText(),
      messageCount: messageHistory.getHistory(sessionId).length,
    });
  } catch (error) {
    logger.error('Chat error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: errorMessage,
      sessionId,
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Chat API Server running on http://localhost:${PORT}`);
  logger.info(`📡 Streaming endpoint: POST /chat/:sessionId/stream`);
  logger.info(`💬 Regular chat endpoint: POST /chat/:sessionId`);
  logger.info(`🆕 Create session: POST /chat/session`);
  logger.info(`📊 Get history: GET /chat/:sessionId/history`);
  logger.info(`🗑️  Clear history: DELETE /chat/:sessionId/history`);
});

export default app;
