import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  GetDashboardResponse,
  GetScoreboardResponse,
  ListQuestionsResponse,
  SubmitAttemptBody,
  SubmitAttemptResponse,
} from "@workspace/api-zod";
import { db, quizAttempts, users } from "@workspace/db";
import { questions, type QuizQuestion } from "../data/questions";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const percent = (score: number, total: number) => Math.round((score / Math.max(total, 1)) * 100);

async function attemptsForUser(userId: number) {
  return db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.createdAt));
}

function scoreAnswer(question: QuizQuestion, answer: string): boolean {
  try {
    if (question.type === "single") {
      return Number(answer) === question.correctAnswer;
    }
    if (question.type === "multi") {
      const selected = answer.split(",").map(Number).sort((a, b) => a - b);
      const expected = [...question.correctAnswers].sort((a, b) => a - b);
      return selected.length === expected.length && selected.every((v, i) => v === expected[i]);
    }
    if (question.type === "fill") {
      return answer.trim().toLowerCase() === question.correctText.trim().toLowerCase();
    }
    if (question.type === "match") {
      const pairs = answer.split(",").map(Number);
      return (
        pairs.length === question.correctPairs.length &&
        pairs.every((v, i) => v === question.correctPairs[i])
      );
    }
    if (question.type === "order") {
      const positions = answer.split(",").map(Number);
      return (
        positions.length === question.correctOrder.length &&
        positions.every((v, i) => v === question.correctOrder[i])
      );
    }
  } catch {
    return false;
  }
  return false;
}

router.get("/dashboard", requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const attempts = await attemptsForUser(user.id);
  const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.percentage), 0);
  const lastScore = attempts[0]?.percentage ?? null;
  const locked = user.quizOnce && attempts.length > 0;

  res.json(
    GetDashboardResponse.parse({
      attemptsCount: attempts.length,
      bestScore,
      lastScore,
      canTakeQuiz: !locked,
      lockReason: locked ? "Искористили сте свој једини покушај за квиз." : null,
    }),
  );
});

router.get("/questions", requireAuth, (_req, res) => {
  res.json(
    ListQuestionsResponse.parse(
      questions.map((q) => ({ ...q, imageQuestion: q.imageQuestion ?? null })),
    ),
  );
});

router.post("/attempts", requireAuth, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const previousAttempts = await attemptsForUser(user.id);
  if (user.quizOnce && previousAttempts.length > 0) {
    res.status(403).json({ message: "Искористили сте свој једини покушај за квиз." });
    return;
  }

  const body = SubmitAttemptBody.parse(req.body);
  const answerMap = new Map(body.answers.map((a) => [a.questionId, a.answer]));
  const score = questions.reduce((total, question) => {
    const answer = answerMap.get(question.id);
    if (answer === undefined) return total;
    return total + (scoreAnswer(question, answer) ? 1 : 0);
  }, 0);
  const total = questions.length;
  const percentage = percent(score, total);
  const passed = percentage >= 60;

  const [attempt] = await db
    .insert(quizAttempts)
    .values({ userId: user.id, score, total, percentage, passed, answers: body.answers })
    .returning();

  res.json(
    SubmitAttemptResponse.parse({
      id: attempt.id,
      score: attempt.score,
      total: attempt.total,
      percentage: attempt.percentage,
      passed: attempt.passed,
      createdAt: attempt.createdAt.toISOString(),
    }),
  );
});

router.get("/scoreboard", requireAuth, async (_req, res) => {
  const allUsers = await db.select().from(users).where(and(eq(users.active, true), eq(users.role, "student")));
  const allAttempts = await db.select().from(quizAttempts).orderBy(desc(quizAttempts.createdAt));

  const rows = allUsers
    .map((user) => {
      const attempts = allAttempts.filter((attempt) => attempt.userId === user.id);
      return {
        username: user.username,
        fullName: user.fullName,
        bestScore: attempts.reduce((best, attempt) => Math.max(best, attempt.percentage), 0),
        attemptsCount: attempts.length,
        lastScore: attempts[0]?.percentage ?? null,
      };
    })
    .sort((a, b) => b.bestScore - a.bestScore || a.fullName.localeCompare(b.fullName))
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  res.json(GetScoreboardResponse.parse(rows));
});

export default router;
