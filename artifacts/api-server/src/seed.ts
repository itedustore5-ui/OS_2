import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";

const defaultUsers = [
  {
    username: "admin",
    password: "Admin2024!",
    fullName: "Administrator",
    role: "admin",
    active: true,
    neverExpires: true,
    quizOnce: false,
  },
  {
    username: "student1",
    password: "kviz2024",
    fullName: "Student 1",
    role: "student",
    active: true,
    neverExpires: true,
    quizOnce: true,
  },
] as const;

export async function seedDefaultUsers() {
  for (const item of defaultUsers) {
    const [existing] = await db.select().from(users).where(eq(users.username, item.username)).limit(1);
    const passwordHash = await bcrypt.hash(item.password, 10);

    if (existing) {
      await db
        .update(users)
        .set({
          passwordHash,
          passwordPlain: item.password,
          fullName: item.fullName,
          role: item.role,
          active: item.active,
          neverExpires: item.neverExpires,
          quizOnce: item.quizOnce,
        })
        .where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({
        username: item.username,
        passwordHash,
        passwordPlain: item.password,
        fullName: item.fullName,
        role: item.role,
        active: item.active,
        neverExpires: item.neverExpires,
        quizOnce: item.quizOnce,
      });
    }
  }
}
