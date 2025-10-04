import express from "express";
import { auth, AuthRequest } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard", auth, (req: AuthRequest, res) => {
  const user = req.user;
  res.json({ message: `Hello ${user?.uid}` });
});

export default router;
