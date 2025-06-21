import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import logger from '@utils/logger';
import { google } from 'googleapis';
import { AgentFactory } from '../agents/factory';
import { createAuthError } from '../utils/api-error';
import { ErrorCodes } from '../utils/error-code';
import { SessionService } from '../services/session';

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

const sessionService = new SessionService();
const SESSION_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Store user session
 */
export const storeUserSession = async (
  token: string,
  user: Session
): Promise<void> => {
  await sessionService.createSession(
    token,
    { ...user, createdAt: new Date() },
    SESSION_EXPIRATION_SECONDS
  );
};

/**
 * Get user session
 */
export const getUserSession = async (
  token: string
): Promise<Session | null> => {
  return sessionService.getSession(token);
};

/**
 * Remove user session
 */
export const removeUserSession = async (token: string): Promise<void> => {
  await sessionService.deleteSession(token);
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
    await removeUserSession(token);
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
    await sessionService.updateSession(token, userSession);

    // Update agent factory with new access token
    if (userSession.accessToken) {
      AgentFactory.getInstance().updateAccessToken(userSession.accessToken);
    }
  } catch (error) {
    logger.error('Failed to refresh access token:', error);
    // If refresh fails, the user needs to re-authenticate.
    await removeUserSession(token);
    throw createAuthError(
      ErrorCodes.REFRESH_TOKEN_ERROR,
      'Session expired, please log in again.'
    );
  }
};

/**
 * Authentication middleware for Hono
 */
export const requireAuth = async (c: Context, next: Next): Promise<void> => {
  let token: string | undefined;

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = getCookie(c, 'auth_token');
  }

  if (!token) {
    throw createAuthError(ErrorCodes.AUTH_REQUIRED);
  }

  const userSession = await getUserSession(token);

  if (!userSession) {
    throw createAuthError(ErrorCodes.INVALID_TOKEN);
  }

  await refreshAccessTokenIfNeeded(token, userSession);

  c.set('user', userSession);
  await next();
};

/**
 * Optional authentication middleware for Hono
 */
export const optionalAuth = async (c: Context, next: Next): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = getCookie(c, 'auth_token');
    }

    if (token) {
      const userSession = await getUserSession(token);
      if (userSession) {
        c.set('user', userSession);
      }
    }
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
  }
  await next();
};
