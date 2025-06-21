import { query } from './database';
import { Session } from '../middleware/auth';

export interface StoredSession {
  id: string;
  user_id: string;
  data: Session;
  expires_at: Date;
  created_at: Date;
}

export const createSession = async (
  id: string,
  userId: string,
  data: Session,
  expiresAt: Date
): Promise<StoredSession> => {
  const result = await query<StoredSession>(
    'INSERT INTO sessions (id, user_id, data, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, userId, JSON.stringify(data), expiresAt]
  );
  return result.rows[0];
};

export const getSessionById = async (
  id: string
): Promise<StoredSession | null> => {
  const result = await query<StoredSession>(
    'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
    [id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
};

export const deleteSessionById = async (id: string): Promise<void> => {
  await query('DELETE FROM sessions WHERE id = $1', [id]);
};

export const updateSession = async (
  id: string,
  data: Session
): Promise<StoredSession | null> => {
  const result = await query<StoredSession>(
    'UPDATE sessions SET data = $1 WHERE id = $2 RETURNING *',
    [JSON.stringify(data), id]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
};

export const deleteExpiredSessions = async (): Promise<void> => {
  await query('DELETE FROM sessions WHERE expires_at <= NOW()');
};
