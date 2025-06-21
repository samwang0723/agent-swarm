import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { apiRouter } from '@/api/routes';
import logger from '@/shared/utils/logger';
import { ApiError } from '@/shared/utils/api-error';
import { ErrorCodes } from '@/shared/utils/error-code';

const app = new Hono();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
// Add cookie parser middleware - Hono has built-in cookie helpers, no middleware needed.
// For serving a simple web interface
app.use('/*', serveStatic({ root: './public' }));
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// CORS middleware
app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    allowHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    maxAge: 86400,
  })
);

// Mount API routes
app.route('/api/v1', apiRouter);

// 404 handler
app.notFound(c => {
  return c.json(
    {
      error: 'Route not found',
      code: ErrorCodes.NOT_FOUND,
      details: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// Error handling middleware
app.onError((err, c) => {
  logger.error('Error caught by error handler:', {
    error: err.message,
    // stack: err.stack,
    url: c.req.path,
    method: c.req.method,
  });

  if (err instanceof ApiError) {
    return c.json(err.toJSON(), err.statusCode as any);
  }

  // Handle specific known error types
  if (err.name === 'ValidationError') {
    return c.json(
      {
        error: 'Validation failed',
        code: ErrorCodes.VALIDATION_ERROR,
        details: err.message,
      },
      400
    );
  }

  // Default fallback for unhandled errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  return c.json(
    {
      error: 'Internal server error',
      code: ErrorCodes.INTERNAL_ERROR,
      ...(isDevelopment && {
        details: {
          message: err.message,
          stack: err.stack,
        },
      }),
    },
    500
  );
});

logger.info(`🚀 Agent Swarm API Server running on http://localhost:${PORT}`);
logger.info(`📋 API Documentation: http://localhost:${PORT}/api/v1/docs`);
logger.info(`🔐 Authentication: http://localhost:${PORT}/api/v1/auth/google`);
logger.info(`📡 Streaming endpoint: POST /api/v1/chat/stream`);
logger.info(`💬 Regular chat endpoint: POST /api/v1/chat`);
logger.info(`📊 Get history: GET /api/v1/chat/history`);
logger.info(`🗑️  Clear history: DELETE /api/v1/chat/history`);
logger.info(`🏥 Health check: GET /api/v1/health`);

export default {
  port: PORT,
  fetch: app.fetch,
};
