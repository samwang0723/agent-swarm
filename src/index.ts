import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes';
import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import logger from '@utils/logger';
import fetch from 'node-fetch';

if (!globalThis.fetch) {
  // @ts-expect-error: Assigning fetch to globalThis for node-fetch polyfill
  globalThis.fetch = fetch;
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser()); // Add cookie parser middleware
app.use(express.static('public')); // For serving a simple web interface

// CORS middleware
app.use(corsMiddleware);

// Mount API routes
app.use('/', apiRouter);

// 404 handler - must come before error handler
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Agent Swarm API Server running on http://localhost:${PORT}`);
  logger.info(`📋 API Documentation: http://localhost:${PORT}/api/v1/docs`);
  logger.info(`🔐 Authentication: http://localhost:${PORT}/api/v1/auth/google`);
  logger.info(`📡 Streaming endpoint: POST /api/v1/chat/stream`);
  logger.info(`💬 Regular chat endpoint: POST /api/v1/chat`);
  logger.info(`📊 Get history: GET /api/v1/chat/history`);
  logger.info(`🗑️  Clear history: DELETE /api/v1/chat/history`);
  logger.info(`🏥 Health check: GET /api/v1/health`);
});

export default app;
