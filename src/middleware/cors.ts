import { Request, Response, NextFunction } from 'express';

/**
 * CORS middleware configuration
 */
export const corsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};
