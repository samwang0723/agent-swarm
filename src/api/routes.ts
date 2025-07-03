import { Hono } from 'hono';
import { authRouter } from '../features/users/user.controller';
import { chatRouter } from '../features/conversations/conversation.controller';
import { healthRouter } from '../features/health/health.controller';

const apiRouter = new Hono();

// Mount routes
apiRouter.route('/auth', authRouter);
apiRouter.route('/chat', chatRouter);
apiRouter.route('/health', healthRouter);

export { apiRouter };
