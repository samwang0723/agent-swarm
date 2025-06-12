import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes';
import { corsMiddleware } from './middleware/cors';
import logger from '@utils/logger';

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

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Something went wrong',
    code: 'INTERNAL_ERROR',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  });
});

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
