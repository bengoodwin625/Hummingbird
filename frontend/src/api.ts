/** Typed client for the Hummingbird backend. */
import type { Band } from "./art/sprites";

export type Outcome = "correct" | "wrong" | "timeout";
export type QuestionType = "choice" | "number" | "text";

export interface SlotResult {
  slot: number;
  outcome: Outcome;
  band: Band | null;
  points: number;
  elapsed_ms: number | null;
}

export interface Today {
  date: string;
  number: number | null;
  has_quiz: boolean;
  status: "no_quiz" | "not_started" | "in_progress" | "finished";
  total_score: number;
  answered: SlotResult[];
  next_slot: number | null;
  question_live: boolean;
  total_questions: number;
  max_score: number;
  next_unlock_at: string;
  player_id: string;
}

export interface Question {
  slot: number;
  total: number;
  type: QuestionType;
  category: string;
  text: string;
  options: Array<{ id: number; text: string }>;
  read_remaining_ms: number;
}

export interface Reveal {
  slot: number;
  outcome: Outcome;
  elapsed_ms: number | null;
  band: Band | null;
  points: number;
  total_score: number;
  correct_answer: string;
  correct_option_id: number | null;
  chosen_option_id: number | null;
  your_answer: string | null;
  finished: boolean;
}

export type Served = { kind: "question"; question: Question } | { kind: "reveal"; reveal: Reveal };

export interface ResultQuestion {
  slot: number;
  text: string;
  category: string;
  type: QuestionType;
  your_answer: string | null;
  correct_answer: string;
  outcome: Outcome;
  elapsed_ms: number | null;
  band: Band | null;
  points: number;
  percent_correct: number;
}

export interface Results {
  date: string;
  number: number;
  total_score: number;
  max_score: number;
  correct_count: number;
  avg_correct_elapsed_ms: number | null;
  questions: ResultQuestion[];
  speed: {
    faster_than_percent: number | null;
    players: number;
    everyone_avg_ms: number | null;
    fastest_ms: number | null;
  };
  standing: {
    rank: number;
    players: number;
    better_than_percent: number | null;
    average_score: number;
    /** Finished totals per bucket from 0 to the daily maximum, you included. */
    distribution: number[];
    bucket_size: number;
  };
  next_unlock_at: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const PLAYER_KEY = "rq_pid";

function backupId(): string | null {
  try {
    return window.localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}

export function rememberPlayer(id: string): void {
  try {
    window.localStorage.setItem(PLAYER_KEY, id);
  } catch {
    // Private mode or storage blocked: the cookie still identifies the player.
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const backup = backupId();
  if (backup) headers["X-RapidQ-Player"] = backup;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "Couldn't reach Hummingbird. Check your connection.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data ?? {}) as Record<string, unknown>;
    throw new ApiError(
      response.status,
      typeof detail.code === "string" ? detail.code : "error",
      typeof detail.message === "string" ? detail.message : "Something went wrong.",
      detail,
    );
  }
  return data as T;
}

export const api = {
  today: () => request<Today>("GET", "/api/today"),
  ready: () => request<Served>("POST", "/api/play/ready"),
  answerChoice: (slot: number, optionId: number) =>
    request<Reveal>("POST", "/api/play/answer", { slot, option_id: optionId }),
  answerText: (slot: number, value: string) =>
    request<Reveal>("POST", "/api/play/answer", { slot, value }),
  timeout: (slot: number) => request<Reveal>("POST", "/api/play/timeout", { slot }),
  results: () => request<Results>("GET", "/api/results"),
};
