import * as sessionRepo from '@/repository/session';
import { Session } from '@/middleware/auth';

export class SessionService {
  public async createSession(
    token: string,
    session: Session,
    expiresInSeconds: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await sessionRepo.createSession(token, session.id, session, expiresAt);
  }

  public async getSession(token: string): Promise<Session | null> {
    const storedSession = await sessionRepo.getSessionById(token);
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
    await sessionRepo.deleteSessionById(token);
  }

  public async updateSession(token: string, session: Session): Promise<void> {
    await sessionRepo.updateSession(token, session);
  }
}
