import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    uid: string
    role: string
    batchType?: string
    id: string
    fullName?: string
    userId: string
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Ensure both id and userId are available for backward compatibility
    const userId = decoded.id || decoded.userId;
    req.user = {
      ...decoded,
      id: userId,
      userId: userId, // Ensure userId is always present
      fullName: decoded.fullName || decoded.name // Handle various name fields
    };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// Export auth as alias for authenticateToken for backward compatibility
export const auth = authenticateToken;
