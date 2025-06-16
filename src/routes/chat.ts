import express, { Response, Router } from 'express';
import { messageHistory } from '@messages/history';
import { sendMessage } from '@messages/chat';
import { SSEOutput } from '@messages/output-strategies';
import { OutputStrategy } from '@messages/types';
import logger from '@utils/logger';
import {
  createModel,
  getCurrentModelInfo,
  getAvailableModels,
} from '@config/models';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router: Router = express.Router();

// Initialize the model using the configuration handler
const model = createModel();

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
router.get('/models', requireAuth, (req, res: Response) => {
  try {
    const current = getCurrentModelInfo();
    const available = getAvailableModels();

    res.json({
      current,
      available,
    });
  } catch (error) {
    logger.error('Error retrieving model information:', error);
    res.status(500).json({
      error: 'Failed to retrieve model information',
    });
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
router.get('/history', requireAuth, (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const history = messageHistory.getHistory(userId);

  res.json({
    userId,
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
router.delete('/history', requireAuth, (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  messageHistory.clearHistory(userId);
  res.json({ message: 'History cleared', userId });
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
router.post('/stream', requireAuth, async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const { message } = authReq.body;

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
    const sseOutput = new SSEOutput(res, userId);

    // Use the unified sendMessage function with SSE output
    await sendMessage(authReq.user, model, message, sseOutput);
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

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: Send message with complete response for authenticated user
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
 *         description: Chat response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 response:
 *                   type: string
 *                 messageCount:
 *                   type: integer
 *       400:
 *         description: Bad request - invalid message
 *       401:
 *         description: Unauthorized - authentication required
 *       500:
 *         description: Server error
 */
router.post('/', requireAuth, async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const { message } = authReq.body;

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
    await sendMessage(authReq.user, model, message, collectOutput);

    res.json({
      userId,
      response: (collectOutput as any).getFullText(),
      messageCount: messageHistory.getHistory(userId).length,
    });
  } catch (error) {
    logger.error('Chat error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: errorMessage,
      userId,
    });
  }
});

export { router as chatRouter };
