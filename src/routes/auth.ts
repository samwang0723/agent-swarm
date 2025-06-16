import express, { Request, Response, Router } from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import logger from '@utils/logger';
import {
  storeUserSession,
  removeUserSession,
  Session,
  requireAuth,
  AuthenticatedRequest,
} from '../middleware/auth';
import { ApiError, createServerError } from '../utils/api-error';
import { ErrorCodes } from '../utils/error-code';
import { asyncHandler } from '../middleware/error-handler';

const router: Router = express.Router();

// Gmail OAuth Configuration
const OAuth2 = google.auth.OAuth2;
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://localhost:${process.env.PORT || 3000}/api/v1/auth/google/callback`;

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

/**
 * Generate a simple session token (replace with JWT in production)
 */
const generateSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth consent screen
 *       500:
 *         description: Server error
 */
router.get(
  '/google',
  asyncHandler(async (req: Request, res: Response) => {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    try {
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state: 'gmail-auth', // CSRF protection
        include_granted_scopes: true,
        response_type: 'code',
      });

      logger.info(`Redirecting to Google OAuth: ${authUrl}`);
      res.redirect(authUrl);
    } catch (error) {
      logger.error('Error generating auth URL:', error);
      throw createServerError(
        ErrorCodes.AUTH_INIT_ERROR,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  })
);

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     summary: Handle Google OAuth callback
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     picture:
 *                       type: string
 *                     sessionId:
 *                       type: string
 *                       description: Auto-created chat session ID
 *       400:
 *         description: Bad request - invalid parameters
 *       500:
 *         description: Server error
 */
router.get(
  '/google/callback',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query;

    logger.info(`Callback received with: code: ${!!code} state: ${state}`);

    if (state !== 'gmail-auth') {
      logger.error('Invalid state parameter');
      res.redirect('/?auth=error&reason=invalid_state');
      return;
    }

    if (!code) {
      logger.error('Authorization code is missing');
      res.redirect('/?auth=error&reason=missing_code');
      return;
    }

    try {
      // Create a new OAuth2 client instance for this request
      const callbackOAuth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      // Exchange code for tokens using the new client instance
      const { tokens } = await callbackOAuth2Client.getToken(code as string);
      logger.info('Tokens received successfully');
      logger.info('Token details:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date,
      });

      if (!tokens.refresh_token) {
        logger.warn(
          'Refresh token not received. User may need to re-authenticate for offline access.'
        );
      }

      // Set credentials on the new client instance
      callbackOAuth2Client.setCredentials(tokens);

      // Try to get user info using direct fetch with access token as fallback
      let userInfo: {
        id?: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      try {
        // First try with the Google API client
        const oauth2 = google.oauth2({
          version: 'v2',
          auth: callbackOAuth2Client,
        });
        const response = await oauth2.userinfo.get();
        userInfo = {
          id: response.data.id || undefined,
          email: response.data.email || undefined,
          name: response.data.name || undefined,
          picture: response.data.picture || undefined,
        };
        logger.info('User info retrieved via Google API client');
      } catch (apiError) {
        logger.warn('Google API client failed, trying direct fetch:', {
          error:
            apiError instanceof Error ? apiError.message : String(apiError),
          stack: apiError instanceof Error ? apiError.stack : undefined,
        });

        // Fallback to direct fetch with access token
        if (tokens.access_token) {
          logger.info(
            `Attempting direct fetch with access token: ${tokens.access_token.substring(0, 20)}...`
          );

          // Try the userinfo endpoint with Authorization header
          const userInfoResponse = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                Accept: 'application/json',
              },
            }
          );

          logger.info(
            `Direct fetch response status: ${userInfoResponse.status}`
          );

          if (!userInfoResponse.ok) {
            const errorText = await userInfoResponse.text();
            logger.error(`Direct fetch error response: ${errorText}`);
            throw createServerError(
              ErrorCodes.GOOGLE_USERINFO_ERROR,
              `Direct fetch failed: ${userInfoResponse.status} ${userInfoResponse.statusText}`,
              { status: userInfoResponse.status, response: errorText }
            );
          }

          userInfo = (await userInfoResponse.json()) as {
            id?: string;
            email?: string;
            name?: string;
            picture?: string;
          };
          logger.info('User info retrieved via direct fetch');
        } else {
          throw createServerError(
            ErrorCodes.GOOGLE_TOKEN_ERROR,
            'No access token available for direct fetch'
          );
        }
      }

      // Create a chat session automatically using user ID
      const chatSessionId = randomUUID();

      const user = {
        id: userInfo.id || randomUUID(),
        email: userInfo.email || '',
        name: userInfo.name || undefined,
        picture: userInfo.picture || undefined,
        sessionId: chatSessionId, // Include chat session ID
        accessToken: tokens.access_token || undefined, // Store Google access token
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiryDate: tokens.expiry_date || undefined,
      };

      // Generate session token and store user with session info
      const sessionToken = generateSessionToken();
      storeUserSession(sessionToken, user as Session);

      logger.info(
        `User authenticated with auto-created session: ${user.email} (sessionId: ${chatSessionId})`
      );

      // Set HTTP-only cookie for session
      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Redirect to frontend with success
      res.redirect('/?auth=success');
    } catch (error) {
      logger.error('OAuth callback error:', error);

      // If it's already an ApiError, let it bubble up to the error handler
      if (error instanceof ApiError) {
        throw error;
      }

      // For other errors, redirect to frontend with error
      res.redirect('/?auth=error&reason=server_error');
    }
  })
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 picture:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userSession = (req as AuthenticatedRequest).user;

    res.json({
      id: userSession.id,
      email: userSession.email,
      name: userSession.name,
      picture: userSession.picture,
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
      try {
        // Remove session from memory
        removeUserSession(token);
        logger.info('User session removed');
      } catch (error) {
        logger.error('Error removing session:', error);
        throw createServerError(
          ErrorCodes.LOGOUT_ERROR,
          'Failed to remove user session',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Clear the session cookie
    res.clearCookie('session_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

export { router as authRouter };
