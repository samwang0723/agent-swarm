import * as userRepo from '@/repository/user';

interface GoogleUserInfo {
  email?: string | null;
  name?: string | null;
}

interface GoogleTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}

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

  public async updateLastLogin(userId: string): Promise<void> {
    await userRepo.updateUserLastLogin(userId);
  }

  public async deleteGoogleIntegration(userId: string): Promise<void> {
    await userRepo.deleteIntegration(userId, 'google');
  }
}
