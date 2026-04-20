import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { db, users, type User } from "@workspace/db";
import { createToken, requireAuth, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const publicUser = (user: User) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role as "admin" | "student",
  active: user.active,
  neverExpires: user.neverExpires,
  quizOnce: user.quizOnce,
});

router.post("/auth/login", async (req, res) => {
  const body = LoginBody.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.username, body.username)).limit(1);

  if (!user || !user.active) {
    res.status(401).json({ message: "Погрешно корисничко име или лозинка." });
    return;
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ message: "Погрешно корисничко име или лозинка." });
    return;
  }

  res.json(LoginResponse.parse({ token: createToken(user), user: publicUser(user) }));
});

router.get("/auth/me", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  res.json(GetMeResponse.parse(publicUser(user)));
});

export default router;
