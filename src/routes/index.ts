import express, { Router } from 'express';
import { authRouter } from './auth';
import { chatRouter } from './chat';
import { healthRouter } from './health';

const router: Router = express.Router();

// API versioning - following OpenAPI standards
const API_VERSION = 'v1';

// Mount routes with version prefix
router.use(`/api/${API_VERSION}/auth`, authRouter);
router.use(`/api/${API_VERSION}/chat`, chatRouter);
router.use(`/api/${API_VERSION}/health`, healthRouter);

export { router as apiRouter, API_VERSION };
