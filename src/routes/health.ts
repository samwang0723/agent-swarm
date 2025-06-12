import express, { Request, Response, Router } from 'express';
import { toolRegistry } from '@tools/index';

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 mcp:
 *                   type: object
 *                   description: MCP status information
 *                 tools:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     names:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/', async (req: Request, res: Response) => {
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

export { router as healthRouter };
