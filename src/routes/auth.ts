import express, { Request, Response, Router } from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import logger from '@utils/logger';
import {
  storeUserSession,
  getUserSession,
  removeUserSession,
} from '../middleware/auth';

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
router.get('/google', (req: Request, res: Response) => {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: 'gmail-auth', // CSRF protection
      include_granted_scopes: true,
      response_type: 'code',
    });

    logger.info(`Redirecting to Google OAuth: ${authUrl}`);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({
      error: 'Authentication initialization failed',
      code: 'AUTH_INIT_ERROR',
    });
  }
});

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
  async (req: Request, res: Response): Promise<void> => {
    try {
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
        logger.warn('Google API client failed, trying direct fetch:', apiError);

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
            throw new Error(
              `Direct fetch failed: ${userInfoResponse.status} ${userInfoResponse.statusText}`
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
          throw new Error('No access token available for direct fetch');
        }
      }

      // Create a chat session automatically using user ID
      const chatSessionId = userInfo.id || randomUUID();

      const user = {
        id: userInfo.id || '',
        email: userInfo.email || '',
        name: userInfo.name || undefined,
        picture: userInfo.picture || undefined,
        sessionId: chatSessionId, // Include chat session ID
      };

      // Generate session token and store user with session info
      const sessionToken = generateSessionToken();
      storeUserSession(sessionToken, user);

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
      res.redirect('/?auth=error&reason=server_error');
    }
  }
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
router.get('/me', (req: Request, res: Response): void => {
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
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const userSession = getUserSession(token);

    if (!userSession) {
      res.status(401).json({
        error: 'Invalid session token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    res.json({
      id: userSession.id,
      email: userSession.email,
      name: userSession.name,
      picture: userSession.picture,
    });
  } catch (error) {
    logger.error('User info error:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      code: 'USER_INFO_ERROR',
    });
  }
});

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
router.post('/logout', (req: Request, res: Response): void => {
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
      // Remove session from memory
      removeUserSession(token);
      logger.info('User session removed');
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
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    });
  }
});

export { router as authRouter };
