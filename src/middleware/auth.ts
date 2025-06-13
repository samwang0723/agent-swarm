import { Request, Response, NextFunction } from 'express';
import logger from '@utils/logger';

export interface Session {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  sessionId: string;
  accessToken?: string;
  createdAt: Date;
}

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
  user: Session;
}

/**
 * Simple session-based authentication middleware
 * This is a basic implementation - replace with proper JWT/database storage in production
 */

// Simple in-memory storage for demo - replace with proper database
const userSessions = new Map<string, Session>();

/**
 * Store user session
 */
export const storeUserSession = (token: string, user: Session) => {
  userSessions.set(token, {
    ...user,
    createdAt: new Date(),
  });
};

/**
 * Get user session
 */
export const getUserSession = (token: string) => {
  return userSessions.get(token);
};

/**
 * Remove user session
 */
export const removeUserSession = (token: string) => {
  return userSessions.delete(token);
};

/**
 * Authentication middleware - protects routes that require authentication
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fall back to cookie
      token = req.cookies?.session_token;
    }

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token or session cookie',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const userSession = getUserSession(token);

    if (!userSession) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    (req as AuthenticatedRequest).user = userSession;
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional authentication middleware - allows both authenticated and unauthenticated requests
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fall back to cookie
      token = req.cookies?.session_token;
    }

    if (token) {
      const userSession = getUserSession(token);
      if (userSession) {
        (req as AuthenticatedRequest).user = userSession;
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    next(); // Continue even on error for optional auth
  }
};
