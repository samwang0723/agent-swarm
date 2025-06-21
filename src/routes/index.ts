import { Hono } from 'hono';
import { authRouter } from './auth';
import { chatRouter } from './chat';
import { healthRouter } from './health';

const app = new Hono();

// Mount routes
app.route('/auth', authRouter);
app.route('/chat', chatRouter);
app.route('/health', healthRouter);

export { app as apiRouter };
