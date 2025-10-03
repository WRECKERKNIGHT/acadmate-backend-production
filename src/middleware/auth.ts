import { Request, Response, NextFunction } from "express";

// Extend Express Request with user info
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    role: string;
    batchType?: string;
    id: string;
  };
}

// Example auth middleware
export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Your authentication logic
  next();
};


import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Use the global Express Request interface augmentation

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
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
