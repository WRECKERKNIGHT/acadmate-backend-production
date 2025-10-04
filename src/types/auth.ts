import { Request } from 'express'

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

export interface UserPayload {
  uid: string
  role: string
  batchType?: string
  id: string
  fullName?: string
  userId: string
}
