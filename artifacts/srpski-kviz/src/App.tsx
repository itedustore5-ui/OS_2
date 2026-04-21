import { useEffect, useMemo, useState } from "react";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "student";
  active: boolean;
  neverExpires: boolean;
  quizOnce: boolean;
};

type AdminUser = AuthUser & { password: string; createdAt: string };

type Question = {
  id: number;
  type: "single" | "multi" | "fill" | "match" | "order";
  question: string;
  explanation: string;
  imageQuestion: string | null;
  options?: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  correctText?: string;
  hint?: string;
  leftItems?: string[];
  rightItems?: string[];
  correctPairs?: number[];
  items?: string[];
  correctOrder?: number[];
  hasSkips?: boolean;
};

type DashboardStats = {
  attemptsCount: number;
  bestScore: number;
  lastScore: number | null;
  canTakeQuiz: boolean;
  lockReason: string | null;
};
type ScoreboardEntry = {
  rank: number;
  username: string;
  fullName: string;
  bestScore: number;
  attemptsCount: number;
  lastScore: number | null;
};
type AdminResult = {
  id: number;
  username: string;
  fullName: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  createdAt: string;
};

type UserInput = {
  username: string;
  password: string;
  fullName: string;
  role: "admin" | "student";
  active: boolean;
  neverExpires: boolean;
  quizOnce: boolean;
};

const queryClient = new QueryClient();
const TOKEN_KEY = "srpski-kviz-token";
const emptyUser: UserInput = {
  username: "",
  password: "",
  fullName: "",
  role: "student",
  active: true,
  neverExpires: true,
  quizOnce: false,
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Дошло је до грешке.");
  }
  return data as T;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function encodeAnswer(question: Question, shuffleMap: Record<number, number[]>, pending: unknown): string {
  if (question.type === "single") {
    const sm = shuffleMap[question.id] ?? question.options!.map((_, i) => i);
    return String(sm[pending as number]);
  }
  if (question.type === "multi") {
    const sm = shuffleMap[question.id] ?? question.options!.map((_, i) => i);
    const sel = (pending as Set<number>);
    return [...sel].map((si) => sm[si]).sort((a, b) => a - b).join(",");
  }
  if (question.type === "fill") return (pending as string).trim();
  if (question.type === "match") {
    const pairs = pending as Record<number, number>;
    return question.leftItems!.map((_, li) => pairs[li] ?? -1).join(",");
  }
  if (question.type === "order") {
    const positions = pending as Record<number, number>;
    return question.items!.map((_, i) => positions[i] ?? 0).join(",");
  }
  return "";
}

function isAnswerCorrect(question: Question, answer: string): boolean {
  try {
    if (question.type === "single") return Number(answer) === question.correctAnswer;
    if (question.type === "multi") {
      const sel = answer.split(",").map(Number).sort((a, b) => a - b);
      const exp = [...(question.correctAnswers ?? [])].sort((a, b) => a - b);
      return sel.length === exp.length && sel.every((v, i) => v === exp[i]);
    }
    if (question.type === "fill") return answer.trim().toLowerCase() === (question.correctText ?? "").trim().toLowerCase();
    if (question.type === "match") {
      const pairs = answer.split(",").map(Number);
      return pairs.every((v, i) => v === (question.correctPairs ?? [])[i]);
    }
    if (question.type === "order") {
      const pos = answer.split(",").map(Number);
      return pos.every((v, i) => v === (question.correctOrder ?? [])[i]);
    }
  } catch { return false; }
  return false;
}

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<AuthUser>("/auth/me"));
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  return { user, setUser, loading, refresh };
}

function Shell({ user, onLogout, children }: { user: AuthUser; onLogout: () => void; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1d4ed8_0,#111827_36%,#312e81_100%)] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <button onClick={() => navigate("/dashboard")} className="text-left">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Матурски квиз</p>
            <h1 className="text-xl font-black">Електротехничар рачунара</h1>
          </button>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <button className="nav-btn" onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button className="nav-btn" onClick={() => navigate("/quiz")}>Квиз</button>
            <button className="nav-btn" onClick={() => navigate("/scoreboard")}>Scoreboard</button>
            {user.role === "admin" && <button className="nav-btn" onClick={() => navigate("/admin")}>Admin</button>}
            <span className="rounded-full border border-white/15 px-3 py-2 text-blue-100">{user.fullName}</span>
            <button className="rounded-full bg-white px-4 py-2 font-bold text-slate-900" onClick={onLogout}>Одјава</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      onLogin(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Пријава није успела.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#0f172a,#1e3a8a,#4f46e5)] p-4 text-white">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
        <div className="p-8 md:p-12">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.35em] text-blue-200">Припрема</p>
          <h1 className="text-4xl font-black leading-tight md:text-6xl">Припрема за матурски испит.</h1>
          <p className="mt-6 max-w-xl text-lg text-blue-100">Једно питање по једно, објашњење после сваког одговора, јасан напредак.</p>
        </div>
        <form onSubmit={submit} className="bg-slate-950/45 p-8 md:p-12">
          <h2 className="text-2xl font-black">Пријава</h2>
          <label className="mt-8 block text-sm font-bold text-blue-100">Корисничко име</label>
          <input className="input" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
          <label className="mt-4 block text-sm font-bold text-blue-100">Лозинка</label>
          <input className="input" type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-red-500/20 p-3 text-sm text-red-100">{error}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-2xl bg-white px-5 py-4 font-black text-indigo-950 transition hover:scale-[1.01] disabled:opacity-60">
            {loading ? "Пријављивање..." : "Уђи у квиз"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user }: { user: AuthUser }) {
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardStats>("/dashboard").then(setStats).catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/10 p-8 shadow-xl backdrop-blur">
        <p className="text-blue-200">Добро дошли, {user.fullName}</p>
        <h2 className="mt-2 text-4xl font-black">Ваш dashboard</h2>
        {error && <p className="mt-4 text-red-200">{error}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat title="Број покушаја" value={stats?.attemptsCount ?? "—"} />
        <Stat title="Најбољи резултат" value={`${stats?.bestScore ?? 0}%`} />
        <Stat title="Последњи резултат" value={stats?.lastScore == null ? "—" : `${stats.lastScore}%`} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <h3 className="text-2xl font-black">Квиз</h3>
          <p className="mt-2 text-blue-100">Граница за пролаз је 60%. Можете се враћати на претходна питања, али већ одговорена питања остају закључана.</p>
          {stats?.canTakeQuiz ? (
            <button className="primary mt-6" onClick={() => navigate("/quiz")}>Почни квиз</button>
          ) : (
            <p className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-400/15 p-4 text-amber-100">{stats?.lockReason}</p>
          )}
        </div>
        <div className="card space-y-3">
          <button className="secondary w-full" onClick={() => navigate("/scoreboard")}>Погледај scoreboard</button>
          {user.role === "admin" && <button className="secondary w-full" onClick={() => navigate("/admin")}>Admin panel</button>}
        </div>
      </div>
    </section>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-sm text-blue-200">{title}</p>
      <p className="mt-3 text-4xl font-black">{value}</p>
    </div>
  );
}

function SingleUI({ question, shuffleMap, locked, onCommit }: {
  question: Question;
  shuffleMap: Record<number, number[]>;
  locked: string | undefined;
  onCommit: (answer: string) => void;
}) {
  const sm = shuffleMap[question.id] ?? (question.options ?? []).map((_, i) => i);
  const displayOptions = sm.map((origIdx) => (question.options ?? [])[origIdx]);

  return (
    <div className="mt-6 grid gap-3">
      {displayOptions.map((option, si) => {
        const origIdx = sm[si];
        const isSelected = locked !== undefined && Number(locked) === origIdx;
        const isCorrect = origIdx === question.correctAnswer;
        let cls = "answer";
        if (locked !== undefined && isCorrect) cls += " correct";
        if (locked !== undefined && isSelected && !isCorrect) cls += " wrong";
        return (
          <button key={si} className={cls} disabled={locked !== undefined} onClick={() => onCommit(String(origIdx))}>
            {si + 1}. {option}
          </button>
        );
      })}
    </div>
  );
}

function MultiUI({ question, shuffleMap, locked, onCommit }: {
  question: Question;
  shuffleMap: Record<number, number[]>;
  locked: string | undefined;
  onCommit: (answer: string) => void;
}) {
  const sm = shuffleMap[question.id] ?? (question.options ?? []).map((_, i) => i);
  const displayOptions = sm.map((origIdx) => (question.options ?? [])[origIdx]);
  const [sel, setSel] = useState<Set<number>>(new Set());

  useEffect(() => { setSel(new Set()); }, [question.id]);

  const toggle = (si: number) => {
    if (locked !== undefined) return;
    setSel((prev) => { const next = new Set(prev); next.has(si) ? next.delete(si) : next.add(si); return next; });
  };

  const commit = () => {
    if (sel.size === 0) return;
    const origIndices = [...sel].map((si) => sm[si]).sort((a, b) => a - b).join(",");
    onCommit(origIndices);
  };

  const lockedOrigIndices = locked !== undefined ? locked.split(",").map(Number) : null;

  return (
    <div className="mt-6 grid gap-3">
      <p className="text-sm text-blue-200 -mb-1">Изаберите све тачне одговоре:</p>
      {displayOptions.map((option, si) => {
        const origIdx = sm[si];
        const isSelectedNow = sel.has(si);
        const isLockedSelected = lockedOrigIndices?.includes(origIdx) ?? false;
        const isCorrect = (question.correctAnswers ?? []).includes(origIdx);
        let cls = "answer text-left flex items-start gap-3";
        if (locked !== undefined && isCorrect) cls += " correct";
        else if (locked !== undefined && isLockedSelected && !isCorrect) cls += " wrong";
        else if (locked === undefined && isSelectedNow) cls += " selected";
        return (
          <button key={si} className={cls} disabled={locked !== undefined} onClick={() => toggle(si)}>
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${isSelectedNow || (locked !== undefined && isLockedSelected) ? "border-white bg-white/30" : "border-white/40"}`}>
              {(isSelectedNow || (locked !== undefined && isLockedSelected)) && <span className="block h-2.5 w-2.5 rounded-sm bg-white" />}
            </span>
            {si + 1}. {option}
          </button>
        );
      })}
      {locked === undefined && (
        <button className="primary mt-2" disabled={sel.size === 0} onClick={commit}>Потврди одговор</button>
      )}
    </div>
  );
}

function FillUI({ question, locked, onCommit }: {
  question: Question;
  locked: string | undefined;
  onCommit: (answer: string) => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => { setText(""); }, [question.id]);

  const commit = () => { if (text.trim()) onCommit(text.trim()); };

  return (
    <div className="mt-6">
      {question.hint && <p className="mb-3 text-sm italic text-blue-300">Напомена: {question.hint}</p>}
      <input
        className="input text-xl"
        placeholder="Упишите одговор..."
        value={locked !== undefined ? locked : text}
        disabled={locked !== undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
      />
      {locked === undefined && (
        <button className="primary mt-3" disabled={text.trim().length === 0} onClick={commit}>Потврди одговор</button>
      )}
      {locked !== undefined && (
        <p className={`mt-3 font-black ${isAnswerCorrect(question, locked) ? "text-emerald-200" : "text-red-200"}`}>
          {isAnswerCorrect(question, locked) ? "Тачно" : `Нетачно — тачан одговор: ${question.correctText}`}
        </p>
      )}
    </div>
  );
}

function MatchUI({ question, locked, onCommit }: {
  question: Question;
  locked: string | undefined;
  onCommit: (answer: string) => void;
}) {
  const left = question.leftItems ?? [];
  const right = question.rightItems ?? [];
  const [pairs, setPairs] = useState<Record<number, number>>({});
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  useEffect(() => { setPairs({}); setSelectedLeft(null); }, [question.id]);

  const lockedPairs: Record<number, number> = useMemo(() => {
    if (!locked) return pairs;
    return Object.fromEntries(locked.split(",").map((v, i) => [i, Number(v)]));
  }, [locked, pairs]);

  const clickLeft = (li: number) => {
    if (locked !== undefined) return;
    setSelectedLeft((prev) => (prev === li ? null : li));
  };

  const clickRight = (ri: number) => {
    if (locked !== undefined || selectedLeft === null) return;
    setPairs((prev) => ({ ...prev, [selectedLeft]: ri }));
    setSelectedLeft(null);
  };

  const commit = () => {
    if (Object.keys(pairs).length < left.length) return;
    const answer = left.map((_, i) => pairs[i] ?? -1).join(",");
    onCommit(answer);
  };

  const allPaired = Object.keys(locked !== undefined ? lockedPairs : pairs).length >= left.length;

  return (
    <div className="mt-6">
      <p className="mb-4 text-sm text-blue-200">Кликните на ставку лево, затим на одговарајућу ставку десно:</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          {left.map((item, li) => {
            const paired = locked !== undefined ? lockedPairs[li] : pairs[li];
            const isActive = selectedLeft === li;
            const isCorrect = locked !== undefined && (question.correctPairs ?? [])[li] === lockedPairs[li];
            const isWrong = locked !== undefined && (question.correctPairs ?? [])[li] !== lockedPairs[li];
            let cls = "answer text-left text-sm cursor-pointer";
            if (isActive) cls += " ring-2 ring-white";
            if (isCorrect) cls += " correct";
            else if (isWrong) cls += " wrong";
            else if (paired !== undefined) cls += " bg-white/20";
            return (
              <button key={li} className={cls} onClick={() => clickLeft(li)} disabled={locked !== undefined}>
                {item}
                {paired !== undefined && <span className="ml-2 opacity-60">→ {right[paired]}</span>}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 content-start">
          {right.map((item, ri) => {
            const usedByLeft = locked !== undefined
              ? Object.entries(lockedPairs).find(([, v]) => v === ri)?.[0]
              : Object.entries(pairs).find(([, v]) => v === ri)?.[0];
            let cls = "answer text-left text-sm cursor-pointer";
            if (locked !== undefined) {
              const li = usedByLeft !== undefined ? Number(usedByLeft) : -1;
              if (li >= 0) {
                const isCorrect = (question.correctPairs ?? [])[li] === ri;
                cls += isCorrect ? " correct" : " wrong";
              }
            } else if (usedByLeft !== undefined) {
              cls += " bg-white/20";
            }
            return (
              <button key={ri} className={cls} onClick={() => clickRight(ri)} disabled={locked !== undefined || usedByLeft !== undefined}>
                {item}
              </button>
            );
          })}
          {locked !== undefined && (
            <div className="mt-2 text-sm text-blue-200">
              <p className="font-black">Тачни парови:</p>
              {left.map((lItem, li) => (
                <p key={li}>{lItem} → {right[(question.correctPairs ?? [])[li]]}</p>
              ))}
            </div>
          )}
        </div>
      </div>
      {locked === undefined && (
        <button className="primary mt-4" disabled={!allPaired} onClick={commit}>Потврди одговор</button>
      )}
    </div>
  );
}

function OrderUI({ question, locked, onCommit }: {
  question: Question;
  locked: string | undefined;
  onCommit: (answer: string) => void;
}) {
  const items = question.items ?? [];
  const hasSkips = question.hasSkips ?? false;
  const maxPos = hasSkips ? items.filter((_, i) => (question.correctOrder ?? [])[i] > 0).length : items.length;
  const [positions, setPositions] = useState<Record<number, number>>({});
  useEffect(() => { setPositions({}); }, [question.id]);

  const lockedPositions: Record<number, number> = useMemo(() => {
    if (!locked) return positions;
    return Object.fromEntries(locked.split(",").map((v, i) => [i, Number(v)]));
  }, [locked, positions]);

  const allFilled = items.every((_, i) => (locked !== undefined ? lockedPositions[i] : positions[i]) !== undefined);

  const commit = () => {
    const answer = items.map((_, i) => positions[i] ?? 0).join(",");
    onCommit(answer);
  };

  const posOptions = hasSkips
    ? [0, ...Array.from({ length: maxPos }, (_, i) => i + 1)]
    : Array.from({ length: maxPos }, (_, i) => i + 1);

  return (
    <div className="mt-6 grid gap-3">
      <p className="text-sm text-blue-200 -mb-1">
        {hasSkips ? "Додели редни број (1, 2, 3...) или X (нула) за акције које не треба предузети:" : "Додели редни број свакој ставци (1 = прво):"}
      </p>
      {items.map((item, i) => {
        const pos = locked !== undefined ? lockedPositions[i] : positions[i];
        const correctPos = (question.correctOrder ?? [])[i];
        const isCorrect = locked !== undefined && pos === correctPos;
        const isWrong = locked !== undefined && pos !== correctPos;
        return (
          <div key={i} className={`flex items-center gap-3 rounded-2xl border p-3 ${isCorrect ? "border-emerald-400/40 bg-emerald-500/15" : isWrong ? "border-red-400/40 bg-red-500/15" : "border-white/10 bg-white/5"}`}>
            <select
              className="rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white"
              value={pos ?? ""}
              disabled={locked !== undefined}
              onChange={(e) => setPositions((prev) => ({ ...prev, [i]: Number(e.target.value) }))}
            >
              <option value="">—</option>
              {posOptions.map((v) => (
                <option key={v} value={v}>{v === 0 ? "X" : v}</option>
              ))}
            </select>
            <span className="flex-1 text-sm">{item}</span>
            {isWrong && <span className="text-xs text-red-300">тачно: {correctPos === 0 ? "X" : correctPos}</span>}
          </div>
        );
      })}
      {locked === undefined && (
        <button className="primary mt-2" disabled={!allFilled} onClick={commit}>Потврди одговор</button>
      )}
    </div>
  );
}

function QuizPage() {
  const [, navigate] = useLocation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shuffleMap, setShuffleMap] = useState<Record<number, number[]>>({});
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ percentage: number; passed: boolean; score: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const answeredCount = Object.keys(answers).length;
  const question = questions[current];

  useEffect(() => {
    api<Question[]>("/questions")
      .then((qs) => {
        setQuestions(qs);
        const sm: Record<number, number[]> = {};
        for (const q of qs) {
          if ((q.type === "single" || q.type === "multi") && q.options) {
            sm[q.id] = shuffle(q.options.map((_, i) => i));
          }
        }
        setShuffleMap(sm);
      })
      .catch((err) => setError(err.message));
  }, []);

  const commit = (answer: string) => {
    if (!question || answers[question.id] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [question.id]: answer }));
  };

  const submit = async () => {
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId: Number(questionId),
          answer,
        })),
      };
      const saved = await api<{ percentage: number; passed: boolean; score: number; total: number }>(
        "/attempts",
        { method: "POST", body: JSON.stringify(payload) },
      );
      setResult(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Резултат није сачуван.");
    }
  };

  const restart = () => {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setError("");
    const sm: Record<number, number[]> = {};
    for (const q of questions) {
      if ((q.type === "single" || q.type === "multi") && q.options) {
        sm[q.id] = shuffle(q.options.map((_, i) => i));
      }
    }
    setShuffleMap(sm);
  };

  if (result) {
    return (
      <div className="mx-auto max-w-3xl card text-center">
        <p className="text-blue-200">Квиз је завршен</p>
        <h2 className="mt-2 text-6xl font-black">{result.percentage}%</h2>
        <p className={`mt-4 text-2xl font-black ${result.passed ? "text-emerald-200" : "text-red-200"}`}>
          {result.passed ? "Положио/ла" : "Пао/ла"}
        </p>
        <p className="mt-2 text-blue-100">Тачно {result.score} од {result.total} питања.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="secondary" onClick={() => navigate("/dashboard")}>Dashboard</button>
          <button className="secondary" onClick={() => navigate("/scoreboard")}>Scoreboard</button>
          <button className="primary" onClick={restart}>Почни из почетка</button>
        </div>
      </div>
    );
  }

  if (!question) return <div className="card">Учитавање питања...</div>;

  const locked = answers[question.id];
  const progress = Math.round((answeredCount / Math.max(questions.length, 1)) * 100);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-blue-200">Питање {current + 1} од {questions.length}</p>
          <h2 className="text-3xl font-black">Квиз</h2>
        </div>
        <button className="secondary" onClick={restart}>Почни из почетка</button>
      </div>

      <div className="mb-6 h-3 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-blue-200">#{question.id}</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-blue-300">
            {question.type === "single" ? "Један одговор" :
              question.type === "multi" ? "Вишеструки одговори" :
              question.type === "fill" ? "Попунити" :
              question.type === "match" ? "Повезивање" : "Редослед"}
          </span>
        </div>

        {question.imageQuestion && (
          <img
            src={question.imageQuestion}
            alt={`Питање ${question.id}`}
            className="mb-5 max-h-80 w-full rounded-3xl border border-white/10 object-contain"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}

        <h3 className="text-xl font-black leading-relaxed md:text-2xl">{question.question}</h3>

        {question.type === "single" && (
          <SingleUI question={question} shuffleMap={shuffleMap} locked={locked} onCommit={commit} />
        )}
        {question.type === "multi" && (
          <MultiUI question={question} shuffleMap={shuffleMap} locked={locked} onCommit={commit} />
        )}
        {question.type === "fill" && (
          <FillUI question={question} locked={locked} onCommit={commit} />
        )}
        {question.type === "match" && (
          <MatchUI question={question} locked={locked} onCommit={commit} />
        )}
        {question.type === "order" && (
          <OrderUI question={question} locked={locked} onCommit={commit} />
        )}

        {locked !== undefined && question.type !== "fill" && question.type !== "match" && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <p className={`font-black ${isAnswerCorrect(question, locked) ? "text-emerald-200" : "text-red-200"}`}>
              {isAnswerCorrect(question, locked) ? "Тачно!" : "Нетачно"}
            </p>
            <p className="mt-2 text-blue-50">{question.explanation}</p>
          </div>
        )}
        {locked !== undefined && (question.type === "match" || question.type === "fill") && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <p className="text-sm text-blue-100">{question.explanation}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button className="secondary" disabled={current === 0} onClick={() => setCurrent((v) => Math.max(0, v - 1))}>← Назад</button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {questions.map((item, index) => {
            const ans = answers[item.id];
            const state = ans === undefined ? "bg-white/20" : isAnswerCorrect(item, ans) ? "bg-emerald-400" : "bg-red-400";
            return (
              <button
                key={item.id}
                className={`h-4 w-4 rounded ${state} ${index === current ? "ring-2 ring-white" : ""}`}
                title={`Питање ${item.id}`}
                onClick={() => setCurrent(index)}
              />
            );
          })}
        </div>
        {current < questions.length - 1 ? (
          <button className="primary" onClick={() => setCurrent((v) => Math.min(questions.length - 1, v + 1))}>Напред →</button>
        ) : (
          <button className="primary" disabled={answeredCount !== questions.length} onClick={submit}>Заврши квиз</button>
        )}
      </div>
      {error && <p className="mt-4 rounded-2xl bg-red-500/20 p-4 text-red-100">{error}</p>}
    </section>
  );
}

function Scoreboard() {
  const [rows, setRows] = useState<ScoreboardEntry[]>([]);
  useEffect(() => { api<ScoreboardEntry[]>("/scoreboard").then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="card">
      <h2 className="text-3xl font-black">Scoreboard</h2>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead className="text-blue-200">
            <tr><th>Ранг</th><th>Име</th><th>Корисник</th><th>Најбољи</th><th>Последњи</th><th>Покушаји</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.username} className="border-t border-white/10">
                <td className="py-4 font-black">{row.rank}</td>
                <td>{row.fullName}</td>
                <td>{row.username}</td>
                <td>{row.bestScore}%</td>
                <td>{row.lastScore ?? "—"}</td>
                <td>{row.attemptsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminPanel() {
  const [tab, setTab] = useState<"users" | "results">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [results, setResults] = useState<AdminResult[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserInput>(emptyUser);
  const editing = useMemo(() => users.find((u) => u.id === editingId), [users, editingId]);

  const load = async () => {
    setUsers(await api<AdminUser[]>("/admin/users"));
    setResults(await api<AdminResult[]>("/admin/results"));
  };
  useEffect(() => { void load(); }, []);

  const editUser = (user: AdminUser) => {
    setEditingId(user.id);
    setForm({ username: user.username, password: user.password, fullName: user.fullName, role: user.role, active: user.active, neverExpires: user.neverExpires, quizOnce: user.quizOnce });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId) await api(`/admin/users/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
    else await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
    setForm(emptyUser);
    setEditingId(null);
    await load();
  };
  const remove = async (id: number) => { await api(`/admin/users/${id}`, { method: "DELETE" }); await load(); };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={save} className="card">
        <h2 className="text-2xl font-black">{editing ? "Измена корисника" : "Нови корисник"}</h2>
        <input className="input" placeholder="Корисничко име" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" placeholder="Лозинка" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input className="input" placeholder="Пуно ime" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserInput["role"] })}>
          <option value="student">student</option>
          <option value="admin">admin</option>
        </select>
        <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Активан</label>
        <label className="check"><input type="checkbox" checked={form.neverExpires} onChange={(e) => setForm({ ...form, neverExpires: e.target.checked })} /> Не истиче</label>
        <label className="check"><input type="checkbox" checked={form.quizOnce} onChange={(e) => setForm({ ...form, quizOnce: e.target.checked })} /> Само 1x квиз</label>
        <button className="primary mt-4 w-full">Сачувај</button>
        {editingId && <button type="button" className="secondary mt-3 w-full" onClick={() => { setEditingId(null); setForm(emptyUser); }}>Откажи</button>}
      </form>
      <div className="card">
        <div className="mb-5 flex gap-2">
          <button className={tab === "users" ? "primary" : "secondary"} onClick={() => setTab("users")}>Корисници</button>
          <button className={tab === "results" ? "primary" : "secondary"} onClick={() => setTab("results")}>Резултати</button>
        </div>
        {tab === "users" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="text-blue-200">
                <tr><th>Корисник</th><th>Лозинка</th><th>Ime</th><th>Улога</th><th>Статус</th><th>1x</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="py-3 font-bold">{u.username}</td>
                    <td>{u.password}</td>
                    <td>{u.fullName}</td>
                    <td>{u.role}</td>
                    <td>{u.active ? "активан" : "неактиван"}</td>
                    <td>{u.quizOnce ? "да" : "не"}</td>
                    <td className="space-x-2">
                      <button className="mini" onClick={() => editUser(u)}>Измени</button>
                      <button className="mini danger" onClick={() => remove(u.id)}>Обриши</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="text-blue-200">
                <tr><th>Корисник</th><th>Ime</th><th>Резултат</th><th>Статус</th><th>Датум</th></tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="py-3">{r.username}</td>
                    <td>{r.fullName}</td>
                    <td>{r.percentage}% ({r.score}/{r.total})</td>
                    <td>{r.passed ? "положио" : "пао"}</td>
                    <td>{new Date(r.createdAt).toLocaleString("sr-RS")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Protected({ auth, children }: { auth: ReturnType<typeof useAuth>; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  useEffect(() => { if (!auth.loading && !auth.user) navigate("/login"); }, [auth.loading, auth.user, navigate]);
  if (auth.loading) return <div className="min-h-screen bg-slate-950 p-8 text-white">Учитавање...</div>;
  if (!auth.user) return null;
  return <Shell user={auth.user} onLogout={() => { localStorage.removeItem(TOKEN_KEY); auth.setUser(null); navigate("/login"); }}>{children}</Shell>;
}

function AppRouter() {
  const auth = useAuth();
  return (
    <Switch>
      <Route path="/login">{() => <Login onLogin={auth.setUser} />}</Route>
      <Route path="/">{() => <Protected auth={auth}><Dashboard user={auth.user!} /></Protected>}</Route>
      <Route path="/dashboard">{() => <Protected auth={auth}><Dashboard user={auth.user!} /></Protected>}</Route>
      <Route path="/quiz">{() => <Protected auth={auth}><QuizPage /></Protected>}</Route>
      <Route path="/scoreboard">{() => <Protected auth={auth}><Scoreboard /></Protected>}</Route>
      <Route path="/admin">{() => <Protected auth={auth}>{auth.user?.role === "admin" ? <AdminPanel /> : <Dashboard user={auth.user!} />}</Protected>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
