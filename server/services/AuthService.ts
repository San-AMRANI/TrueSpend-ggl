import jwt from 'jsonwebtoken';

export class AuthService {
  login(username?: string, password?: string) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUser && password === adminPass) {
      const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
      return {
        token,
        user: { email: `${username}@local.host`, uid: username }
      };
    }

    throw new Error('Invalid credentials');
  }
}

export const authService = new AuthService();
