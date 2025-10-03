import { Express } from 'express-serve-static-core'

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string
        role: string
        batchType?: string
        id: string
      }
    }
  }
}