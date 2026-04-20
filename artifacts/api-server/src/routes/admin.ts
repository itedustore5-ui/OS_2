import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import {
  CreateUserBody,
  CreateUserResponse,
  DeleteUserParams,
  DeleteUserResponse,
  ListResultsResponse,
  ListUsersResponse,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { db, quizAttempts, users, type User } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const adminUser = (user: User) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role as "admin" | "student",
  active: user.active,
  neverExpires: user.neverExpires,
  quizOnce: user.quizOnce,
  password: user.passwordPlain,
  createdAt: user.createdAt.toISOString(),
});

router.use("/admin", requireAuth, requireAdmin);

router.get("/admin/users", async (_req, res) => {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  res.json(ListUsersResponse.parse(allUsers.map(adminUser)));
});

router.post("/admin/users", async (req, res) => {
  const body = CreateUserBody.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  const [user] = await db
    .insert(users)
    .values({
      username: body.username,
      passwordHash,
      passwordPlain: body.password,
      fullName: body.fullName,
      role: body.role,
      active: body.active,
      neverExpires: body.neverExpires,
      quizOnce: body.quizOnce,
    })
    .returning();

  res.json(CreateUserResponse.parse(adminUser(user)));
});

router.put("/admin/users/:id", async (req, res) => {
  const params = UpdateUserParams.parse({ id: Number(req.params.id) });
  const body = UpdateUserBody.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  const [user] = await db
    .update(users)
    .set({
      username: body.username,
      passwordHash,
      passwordPlain: body.password,
      fullName: body.fullName,
      role: body.role,
      active: body.active,
      neverExpires: body.neverExpires,
      quizOnce: body.quizOnce,
    })
    .where(eq(users.id, params.id))
    .returning();

  if (!user) {
    res.status(404).json({ message: "Корисник није пронађен." });
    return;
  }

  res.json(UpdateUserResponse.parse(adminUser(user)));
});

router.delete("/admin/users/:id", async (req, res) => {
  const params = DeleteUserParams.parse({ id: Number(req.params.id) });
  await db.delete(users).where(eq(users.id, params.id));
  res.json(DeleteUserResponse.parse({ message: "Корисник је обрисан." }));
});

router.get("/admin/results", async (_req, res) => {
  const attempts = await db.select().from(quizAttempts).orderBy(desc(quizAttempts.createdAt));
  const allUsers = await db.select().from(users);
  const rows = attempts.map((attempt) => {
    const user = allUsers.find((item) => item.id === attempt.userId);
    return {
      id: attempt.id,
      userId: attempt.userId,
      username: user?.username ?? "обрисан",
      fullName: user?.fullName ?? "Обрисан корисник",
      score: attempt.score,
      total: attempt.total,
      percentage: attempt.percentage,
      passed: attempt.passed,
      createdAt: attempt.createdAt.toISOString(),
    };
  });

  res.json(ListResultsResponse.parse(rows));
});

export default router;
