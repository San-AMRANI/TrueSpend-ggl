import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

export interface AuthRequest extends Request {
  user?: any;
  dbUser?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = jwt.verify(token, JWT_SECRET) as any;
    req.user = decodedToken;
    
    // Always use the very first user in the database to ensure a single-user app shares all data
    const existingUsers = await db.select().from(users).where(eq(users.email, 'amranihassan.am@gmail.com')).limit(1);
    
    if (existingUsers.length > 0) {
      req.dbUser = existingUsers[0];
    } else {
      // Fallback if DB is completely empty for some reason
      const userResult = await db.insert(users)
        .values({
          uid: decodedToken.username,
          email: decodedToken.username + '@local.host',
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email: decodedToken.username + '@local.host' },
        })
        .returning();
      req.dbUser = userResult[0];
    }
    
    next();
  } catch (error) {
    console.error('Error verifying JWT token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
