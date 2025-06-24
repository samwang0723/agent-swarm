import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Session } from '@/shared/middleware/auth';
import logger from '@/shared/utils/logger';
import {
  createModel,
  getCurrentModelInfo,
  getAvailableModels,
} from '@/shared/config/models';
import { requireAuth } from '@/shared/middleware/auth';
import { initializeSwarm } from '@/features/agents/agent.swarm';
import { messageHistory } from './history.service';
import { sendMessage } from './conversation.service';
import { HonoSSEOutput, OutputStrategy } from './conversation.dto';

type Env = {
  Variables: {
    user: Session;
  };
};

const app = new Hono<Env>();

// Initialize the model using the configuration handler
const model = createModel();
if (!model) {
  throw new Error(
    'Failed to initialize language model. Please check your configuration and API keys.'
  );
}

// Log current model information
const modelInfo = getCurrentModelInfo();
logger.info(
  `Chat API using model: ${modelInfo.modelName} (${modelInfo.provider})`
);

/**
 * @swagger
 * /api/v1/chat/models:
 *   get:
 *     summary: Get current model information and available models
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Model information retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 current:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     modelName:
 *                       type: string
 *                     isConfigured:
 *                       type: boolean
 *                 available:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       provider:
 *                         type: string
 *                       modelName:
 *                         type: string
 *                       isConfigured:
 *                         type: boolean
 *       401:
 *         description: Unauthorized - authentication required
 */
app.get('/models', requireAuth, c => {
  try {
    const current = getCurrentModelInfo();
    const available = getAvailableModels();

    return c.json({
      current,
      available,
    });
  } catch (error) {
    logger.error('Error retrieving model information:', error);
    return c.json(
      {
        error: 'Failed to retrieve model information',
      },
      500
    );
  }
});

/**
 * @swagger
 * /api/v1/chat/history:
 *   get:
 *     summary: Get chat history for authenticated user
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Chat history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 messageCount:
 *                   type: integer
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - authentication required
 */
app.get('/history', requireAuth, c => {
  const user = c.get('user');
  const history = messageHistory.getHistory(user.id);

  return c.json({
    userId: user.id,
    messageCount: history.length,
    messages: history,
  });
});

/**
 * @swagger
 * /api/v1/chat/history:
 *   delete:
 *     summary: Clear chat history for authenticated user
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: History cleared
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       401:
 *         description: Unauthorized - authentication required
 */
app.delete('/history', requireAuth, c => {
  const user = c.get('user');
  messageHistory.clearHistory(user.id);
  return c.json({ message: 'History cleared', userId: user.id });
});

/**
 * @swagger
 * /api/v1/chat/init:
 *   post:
 *     summary: Initialize the chat swarm for the user session
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Swarm initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - authentication required
 */
app.post('/init', requireAuth, c => {
  const user = c.get('user');
  initializeSwarm(user, model);
  return c.json({ success: true, message: 'Swarm initialized' });
});

/**
 * @swagger
 * /api/v1/chat/stream:
 *   post:
 *     summary: Send message with streaming response (SSE) for authenticated user
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: The user message
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: Streaming response
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Bad request - invalid message
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Server error
 */
app.post('/stream', requireAuth, async c => {
  const user = c.get('user');
  const { message } = await c.req.json();

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'Message is required and must be a string' }, 400);
  }

  // Extract request headers for timezone detection
  const requestHeaders: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(c.req.header())) {
    requestHeaders[key.toLowerCase()] = value;
  }

  // Debug logging to see what headers we're receiving
  logger.info('=== REQUEST HEADERS DEBUG ===');
  logger.info('All headers:', JSON.stringify(requestHeaders, null, 2));
  logger.info('X-Client-Timezone header:', requestHeaders['x-client-timezone']);
  logger.info('X-Forwarded-For header:', requestHeaders['x-forwarded-for']);
  logger.info('X-Real-IP header:', requestHeaders['x-real-ip']);
  logger.info('============================');

  return streamSSE(c, async stream => {
    // Create SSE output strategy
    const sseOutput = new HonoSSEOutput(stream, user.id);

    try {
      await sendMessage(user, model, message, sseOutput, requestHeaders);
    } catch (error) {
      logger.error('Error during streaming chat:', error);
      // The HonoSSEOutput's onError will be called from within sendMessage,
      // which will handle closing the stream.
    }
  });
});

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: Send message with regular JSON response for authenticated user
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: The user message
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: The full response from the agent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 cost:
 *                   type: number
 *                 tokens:
 *                   type: integer
 *                 userId:
 *                   type: string
 *       400:
 *         description: Bad request - invalid message
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Server error
 */
app.post('/', requireAuth, async c => {
  const user = c.get('user');
  const { message } = await c.req.json();

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'Message is required and must be a string' }, 400);
  }

  // Extract request headers for timezone detection
  const requestHeaders: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(c.req.header())) {
    requestHeaders[key.toLowerCase()] = value;
  }

  try {
    // Simple output strategy to collect the full response
    const collectOutput = new (class implements OutputStrategy {
      private fullText = '';

      onChunk(text: string, accumulated: string): void {
        this.fullText = accumulated;
      }
      getFullText(): string {
        return this.fullText;
      }
      onError(error: string): void {
        logger.error('Error in collectOutput:', error);
      }
    })();

    await sendMessage(user, model, message, collectOutput, requestHeaders);

    return c.json({
      response: collectOutput.getFullText(),
      userId: user.id,
    });
  } catch (error) {
    logger.error(`Error in /chat endpoint for user ${user.id}:`, error);
    return c.json({ error: 'Failed to get response from agent' }, 500);
  }
});

export { app as chatRouter };
