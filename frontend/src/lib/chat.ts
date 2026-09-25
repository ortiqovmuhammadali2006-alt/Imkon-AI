import { useQuery } from "@tanstack/react-query";
import { api, TOKEN_KEY } from "./api";

export type Conversation = { id: number; title: string; updated_at: string };
export type ChatMessage = { id?: number; role: "user" | "assistant"; content: string };

export const useConversations = () =>
  useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: async () => (await api.get<Conversation[]>("/chat/conversations")).data,
  });

export async function fetchConversation(id: number) {
  const { data } = await api.get<{ conversation: Conversation; messages: ChatMessage[] }>(`/chat/conversations/${id}`);
  return data;
}

export async function createConversation() {
  return (await api.post<Conversation>("/chat/conversations")).data;
}

export async function deleteConversation(id: number) {
  await api.delete(`/chat/conversations/${id}`);
}

export async function renameConversation(id: number, title: string) {
  return (await api.patch<Conversation>(`/chat/conversations/${id}`, { title })).data;
}

const FIRST_TOKEN_TIMEOUT = 60_000;

// Javobni so'zma-so'z oqim (SSE) bilan olish. onDelta — har bir yangi bo'lak.
// Brauzerda axios oqimni o'qiy olmaydi, shuning uchun fetch ishlatiladi
export async function streamMessage(
  conversationId: number,
  content: string,
  {
    voice = false,
    retry = false,
    signal,
    onDelta,
  }: { voice?: boolean; retry?: boolean; signal?: AbortSignal; onDelta: (text: string) => void }
): Promise<{ text: string; error?: string; aborted?: boolean }> {
  // Foydalanuvchi to'xtatishi yoki birinchi so'z juda uzoq kelmasligi (osilib qolish) — ikkalasi ham so'rovni uzadi
  const ctrl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, FIRST_TOKEN_TIMEOUT);

  let text = "";
  let error: string | undefined;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}` },
      body: JSON.stringify({ content, voice, retry }),
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
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf("\n\n")) >= 0) {
        const line = buffer.slice(0, i).replace(/^data: /, "");
        buffer = buffer.slice(i + 2);
        if (!line) continue;
        const event = JSON.parse(line) as { delta?: string; done?: boolean; error?: string };
        if (event.delta) {
          clearTimeout(timer);
          text += event.delta;
          onDelta(text);
        }
        if (event.error) error = event.error;
      }
    }
  } catch (e) {
    if (timedOut) error = "AI juda uzoq javob bermadi. Qayta yuborib ko'ring.";
    else if (signal?.aborted) return { text, aborted: true };
    else error = (e as Error).name === "TypeError" ? "Server bilan bog'lanib bo'lmadi" : "Aloqa uzildi. Qayta yuborib ko'ring.";
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
  if (!text && !error) error = "AI javob bermadi. Qayta yuborib ko'ring.";
  return { text, error };
}
