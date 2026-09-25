import { useQuery } from "@tanstack/react-query";
import { api, TOKEN_KEY } from "./api";

export type Evaluation = "correct" | "partial" | "wrong";

export type TutorPlan = { goal: string; parts: { title: string; summary: string }[] };

export type TutorTurn = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  kind: "message" | "mode" | "start";
  evaluation: Evaluation | null;
  part: number | null;
};

export type TutorState = {
  lesson: { id: number; title: string; subject: string | null; teacher_name: string };
  plan: TutorPlan | null;
  session: { id: number; current_part: number; finished: boolean } | null;
  turns: TutorTurn[];
  modes: { key: string; label: string }[];
};

export type TutorDone = { evaluation: Evaluation | null; part: number; finished: boolean; parts_total: number };

export const useTutor = (lessonId: number) =>
  useQuery({
    queryKey: ["student", "tutor", lessonId],
    queryFn: async () => (await api.get<TutorState>(`/student/lessons/${lessonId}/tutor`)).data,
    enabled: Number.isFinite(lessonId),
  });

const FIRST_TOKEN_TIMEOUT = 60_000;

// AI Tutor navbati (SSE): matn so'zma-so'z keladi, oxirida baho va qism.
// body: { message } — javob, { mode } — "Tushunmadim" usuli, { restart: true } — qaytadan boshlash
export async function streamTutor(
  lessonId: number,
  body: { message?: string; mode?: string; restart?: boolean; voice?: boolean },
  { signal, onDelta, onPlan }: { signal?: AbortSignal; onDelta: (text: string) => void; onPlan?: (plan: TutorPlan) => void }
): Promise<{ text: string; done?: TutorDone; error?: string; aborted?: boolean }> {
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  // Birinchi marta dars rejasi tuziladi — birinchi so'z kechroq kelishi mumkin
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, FIRST_TOKEN_TIMEOUT);

  let text = "";
  let done: TutorDone | undefined;
  let error: string | undefined;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/lessons/${lessonId}/tutor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null);
      return { text: "", error: data?.message ?? "Server bilan bog'lanib bo'lmadi" };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf("\n\n")) >= 0) {
        const line = buffer.slice(0, i).replace(/^data: /, "");
        buffer = buffer.slice(i + 2);
        if (!line) continue;
        const event = JSON.parse(line) as { delta?: string; error?: string; plan?: TutorPlan; done?: boolean } & Partial<TutorDone>;
        if (event.plan) onPlan?.(event.plan);
        if (event.delta) {
          clearTimeout(timer);
          text += event.delta;
          onDelta(text);
        }
        if (event.error) error = event.error;
        if (event.done) done = { evaluation: event.evaluation ?? null, part: event.part ?? 1, finished: !!event.finished, parts_total: event.parts_total ?? 0 };
      }
    }
  } catch (e) {
    if (timedOut) error = "AI juda uzoq javob bermadi. Qayta urinib ko'ring.";
    else if (signal?.aborted) return { text, aborted: true };
    else error = (e as Error).name === "TypeError" ? "Server bilan bog'lanib bo'lmadi" : "Aloqa uzildi. Qayta urinib ko'ring.";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
  if (!text && !error) error = "AI javob bermadi. Qayta urinib ko'ring.";
  return { text, done, error };
}
