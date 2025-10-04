import { Express } from 'express-serve-static-core'

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string
        role: string
        batchType?: string
        id: string
        fullName?: string
        userId: string // Required for destructuring compatibility
      }
    }
  }
}
