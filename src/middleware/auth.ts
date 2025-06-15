import { Request, Response, NextFunction } from 'express';
import logger from '@utils/logger';
import { google } from 'googleapis';
import { AgentFactory } from '../agents/factory';
import { createAuthError } from '../utils/api-error';
import { ErrorCodes } from '../utils/error-code';

export interface Session {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  sessionId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiryDate?: number;
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
 * Checks if the access token is expired and refreshes it if needed.
 * @param token The session token.
 * @param userSession The user session object.
 */
export const refreshAccessTokenIfNeeded = async (
  token: string,
  userSession: Session
): Promise<void> => {
  const isTokenExpired = userSession.tokenExpiryDate
    ? Date.now() > userSession.tokenExpiryDate - 5 * 60 * 1000 // 5-minute buffer
    : false;

  if (!isTokenExpired) {
    return;
  }

  if (!userSession.refreshToken) {
    logger.warn('Access token expired, but no refresh token available.');
    removeUserSession(token);
    throw createAuthError(
      ErrorCodes.REFRESH_TOKEN_ERROR,
      'Session expired, please log in again.'
    );
  }

  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials({
      refresh_token: userSession.refreshToken,
    });

    logger.info(
      'Access token expired, attempting to refresh in refreshAccessTokenIfNeeded...'
    );
    const { credentials } = await client.refreshAccessToken();
    logger.info('Access token refreshed successfully');

    // Update session with new token info
    userSession.accessToken = credentials.access_token || undefined;
    userSession.tokenExpiryDate =
      typeof credentials.expiry_date === 'number'
        ? credentials.expiry_date
        : undefined;

    // The session key (token) remains the same, but the session data is updated.
    storeUserSession(token, userSession);

    // Update agent factory with new access token
    if (userSession.accessToken) {
      AgentFactory.getInstance().updateAccessToken(userSession.accessToken);
    }
  } catch (error) {
    logger.error('Failed to refresh access token:', error);
    // If refresh fails, the user needs to re-authenticate.
    removeUserSession(token);
    throw createAuthError(
      ErrorCodes.REFRESH_TOKEN_ERROR,
      'Session expired, please log in again.'
    );
  }
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
      throw createAuthError(ErrorCodes.AUTH_REQUIRED);
    }

    const userSession = getUserSession(token);

    if (!userSession) {
      throw createAuthError(ErrorCodes.INVALID_TOKEN);
    }

    // Check and refresh token if needed
    await refreshAccessTokenIfNeeded(token, userSession);

    (req as AuthenticatedRequest).user = userSession;
    next();
  } catch (error) {
    next(error);
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
