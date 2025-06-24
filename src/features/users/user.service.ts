import { Session } from '@/shared/middleware/auth';
import { GoogleTokens, GoogleUserInfo } from './user.dto';
import * as userRepo from './user.repository';

export class UserService {
  public async findOrCreateUser(
    userInfo: GoogleUserInfo
  ): Promise<userRepo.User> {
    if (!userInfo.email) {
      throw new Error('User email is missing');
    }
    const existingUser = await userRepo.findUserByEmail(userInfo.email);
    if (existingUser) {
      return existingUser;
    }
    return userRepo.createUser(userInfo.email, userInfo.name ?? undefined);
  }

  public async upsertGoogleIntegration(
    userId: string,
    tokens: GoogleTokens
  ): Promise<userRepo.Integration> {
    if (!tokens.access_token) {
      throw new Error('Access token is missing from Google tokens');
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    return userRepo.upsertIntegration(
      userId,
      'google',
      tokens.access_token,
      tokens.refresh_token ?? null,
      expiresAt
    );
  }

  public async getGoogleIntegration(
    userId: string
  ): Promise<userRepo.Integration | null> {
    return userRepo.getIntegrationByProvider(userId, 'google');
  }

  public async updateLastLogin(userId: string): Promise<void> {
    await userRepo.updateUserLastLogin(userId);
  }

  public async deleteGoogleIntegration(userId: string): Promise<void> {
    await userRepo.deleteIntegration(userId, 'google');
  }
}

export class SessionService {
  public async createSession(
    token: string,
    session: Session,
    expiresInSeconds: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await userRepo.createSession(token, session.id, session, expiresAt);
  }

  public async getSession(token: string): Promise<Session | null> {
    const storedSession = await userRepo.getSessionById(token);
    if (!storedSession) {
      return null;
    }
    // The 'data' column is already a parsed JSON object if using node-postgres
    // but the query returns it as string if it was stringified before insert.
    // The StoredSession interface says data is of type Session.
    // Let's assume it's correctly parsed.
    if (typeof storedSession.data === 'string') {
      return JSON.parse(storedSession.data) as Session;
    }
    return storedSession.data;
  }

  public async deleteSession(token: string): Promise<void> {
    await userRepo.deleteSessionById(token);
  }

  public async updateSession(token: string, session: Session): Promise<void> {
    await userRepo.updateSession(token, session);
  }
}
