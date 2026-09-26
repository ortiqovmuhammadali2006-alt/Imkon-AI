"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AudioLines,
  Bot,
  Check,
  Copy,
  Globe,
  Loader2,
  MessageSquarePlus,
  Mic,
  PanelLeft,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api";
import {
  createConversation,
  deleteConversation,
  fetchConversation,
  streamMessage,
  useConversations,
  type ChatMessage,
} from "@/lib/chat";
import {
  createSpeechStream,
  onChatAsk,
  onVoiceAction,
  RecognitionError,
  speak,
  stopSpeaking,
} from "@/lib/speech";
import { listenAccurate } from "@/lib/recorder";
import Avatar from "@/components/ui/Avatar";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SpeakButton from "@/components/student/SpeakButton";
import Markdown from "./Markdown";
import VoiceChat from "./VoiceChat";
import { OPEN_VOICE_KEY } from "@/lib/assistant";

// retryOf — javob olinmagan savol matni ("Qayta yuborish" uchun)
type UiMessage = ChatMessage & { error?: boolean; streaming?: boolean; retryOf?: string; searching?: boolean };

const SUGGESTIONS: Record<Role, string[]> = {
  student: [
    "Fotosintezni sodda tilda tushuntirib ber",
    "Kasrlarni qo'shishni misol bilan o'rgat",
    "Ingliz tilida 10 ta yangi so'z o'rgat",
    "Matematikadan menga 3 ta oson savol ber",
  ],
  teacher: [
    "Ko'rishi cheklangan o'quvchi uchun dars rejasi tuz",
    "5-sinf uchun kasrlar mavzusida 10 savollik test tuz",
    "Eshitishi cheklangan o'quvchi bilan ishlash bo'yicha maslahat ber",
    "Uy vazifasini baholash mezonlarini tuzib ber",
  ],
  admin: [
    "O'qituvchilar faoliyatini baholash mezonlari",
    "Inklyuziv maktab uchun yillik reja tuz",
    "Ota-onalar bilan ishlash bo'yicha tavsiyalar",
    "Maktab uchun e'lon matnini yozib ber",
  ],
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="btn-secondary px-3 py-1.5 text-sm"
      aria-label="Nusxalash"
    >
      {done ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {done ? "Nusxalandi" : "Nusxalash"}
    </button>
  );
}

// Bitta xabar. memo — javob oqib kelayotganda faqat oxirgi xabar qayta chiziladi, eskilarining markdowni qayta hisoblanmaydi
const MessageItem = memo(function MessageItem({
  m,
  userName,
  canRetry,
  onRetry,
}: {
  m: UiMessage;
  userName: string;
  canRetry: boolean;
  onRetry: (text: string) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <p className="max-w-[85%] rounded-3xl rounded-br-md bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-2.5 whitespace-pre-wrap text-white shadow-md shadow-indigo-500/20">
          {m.content}
        </p>
        <Avatar name={userName} size="sm" />
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
        <Bot className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {m.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-red-800 ring-1 ring-red-200">
            <p className="flex-1">{m.content}</p>
            {canRetry && (
              <button onClick={() => onRetry(m.retryOf!)} className="btn-secondary px-3 py-1.5 text-sm">
                <RotateCcw className="size-4" aria-hidden /> Qayta yuborish
              </button>
            )}
          </div>
        ) : m.content ? (
          <div className="text-[1.02rem] text-slate-800">
            <Markdown>{m.content}</Markdown>
            {m.streaming && <span className="ml-1 inline-block h-5 w-2 animate-pulse rounded-sm bg-indigo-500 align-middle" aria-hidden />}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2" role="status">
            {m.searching ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
                <Globe className="size-4 animate-spin [animation-duration:2s]" aria-hidden /> Internetda qidirilmoqda...
              </span>
            ) : (
              <>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: `${d}ms` }} />
                ))}
                <span className="sr-only">AI javob yozmoqda</span>
              </>
            )}
          </div>
        )}
        {!m.streaming && !m.error && !!m.sources?.length && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-line">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <Globe className="size-3.5" aria-hidden /> Manbalar (internetdan)
            </p>
            <ol className="space-y-1.5">
              {m.sources.map((src, i) => (
                <li key={src.url} className="flex gap-2 text-sm">
                  <span className="text-slate-400">{i + 1}.</span>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-medium text-indigo-700 underline-offset-2 hover:underline">
                    {src.title}
                  </a>
                  <span className="shrink-0 text-slate-400">{new URL(src.url).hostname.replace(/^www\./, "")}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {!m.streaming && !m.error && m.content && (
          <div className="mt-3 flex flex-wrap gap-2">
            <SpeakButton text={m.content} label="Tinglash" />
            <CopyButton text={m.content} />
          </div>
        )}
      </div>
    </div>
  );
});

// ChatGPT kabi AI suhbat sahifasi: suhbatlar ro'yxati, oqim bilan javob, ovozli suhbat rejimi
export default function ChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const conversations = useConversations();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Imkon robotdagi "Ovozli suhbat" — sahifa ochilishi bilan ovozli suhbat boshlanadi.
  // Belgi oyna haqiqatan ochilganda o'chiriladi (dasturlash rejimida effekt ikki marta ishlaydi)
  useEffect(() => {
    let wanted = false;
    try {
      wanted = sessionStorage.getItem(OPEN_VOICE_KEY) === "1";
    } catch {}
    if (!wanted) return;
    const id = setTimeout(() => {
      try {
        sessionStorage.removeItem(OPEN_VOICE_KEY);
      } catch {}
      setVoiceOpen(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  });

  // Yangi xabar kelganda pastga suramiz (faqat chat ichida)
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: streaming ? "auto" : "smooth" });
  }, [messages, streaming]);

  const refreshList = useCallback(() => queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] }), [queryClient]);

  const openConversation = async (id: number) => {
    abortRef.current?.abort();
    setSidebarOpen(false);
    setActiveId(id);
    setLoadingConv(true);
    try {
      const loaded: UiMessage[] = (await fetchConversation(id)).messages;
      // Oxirgi savolga javob kelmay qolgan bo'lsa — qayta yuborish imkonini beramiz
      const last = loaded[loaded.length - 1];
      if (last?.role === "user") {
        loaded.push({ role: "assistant", content: "Bu savolga javob olinmagan.", error: true, retryOf: last.content });
      }
      setMessages(loaded);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoadingConv(false);
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  // Xabar yuborish va javobni oqim bilan ko'rsatish. Javob matnini qaytaradi (ovozli suhbat uchun)
  const send = useCallback(
    async (
      text: string,
      opts: { voice?: boolean; retry?: boolean; onDelta?: (t: string) => void; signal?: AbortSignal } = {}
    ) => {
      const content = text.trim();
      if (!content) return "";
      let convId = activeIdRef.current;
      try {
        if (!convId) {
          convId = (await createConversation()).id;
          activeIdRef.current = convId;
          setActiveId(convId);
        }
      } catch (e) {
        toast.error(getErrorMessage(e));
        return "";
      }

      // Qayta yuborishda savol allaqachon ekranda — faqat xato xabari o'rniga yangi javob kutamiz
      const pending: UiMessage = { role: "assistant", content: "", streaming: true };
      setMessages((m) =>
        opts.retry ? [...m.filter((x, i) => !(i === m.length - 1 && x.error)), pending] : [...m, { role: "user", content }, pending]
      );
      setStreaming(true);
      streamingRef.current = true;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });

      const updateLast = (patch: Partial<UiMessage>) =>
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
          return copy;
        });

      const { text: answer, error, aborted, sources } = await streamMessage(convId, content, {
        voice: opts.voice,
        retry: opts.retry,
        signal: ctrl.signal,
        onSearching: () => updateLast({ searching: true }),
        onDelta: (t) => {
          updateLast({ content: t });
          opts.onDelta?.(t);
        },
      });
      if (answer) updateLast({ streaming: false, searching: false, sources });
      else if (aborted) updateLast({ content: "Javob to'xtatildi.", error: true, retryOf: content, streaming: false });
      else updateLast({ content: error ?? "AI javob bermadi.", error: true, retryOf: content, streaming: false });
      setStreaming(false);
      streamingRef.current = false;
      refreshList();
      return answer;
    },
    [refreshList]
  );

  const submit = () => {
    if (streaming || !input.trim()) return;
    const text = input;
    setInput("");
    send(text);
  };

  const dictate = async () => {
    setDictating(true);
    try {
      // Ovoz yozib olinib, serverda aniq tanitiladi (brauzerning o'zbekcha tanishi sifatsiz)
      const heard = await listenAccurate((state) => setInput(state === "transcribing" ? "Tanilmoqda..." : ""));
      setInput(heard);
      inputRef.current?.focus();
    } catch (e) {
      if (!(e instanceof RecognitionError && e.code === "aborted")) toast.error((e as Error).message);
    } finally {
      setDictating(false);
    }
  };

  // Ovozli suhbat uchun barqaror funksiya (har render yangilanmasin — aks holda suhbat qayta boshlanadi)
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const voiceSend = useCallback(
    (text: string, onDelta: (t: string) => void, signal: AbortSignal) => sendRef.current(text, { voice: true, onDelta, signal }),
    []
  );
  const closeVoice = useCallback(() => setVoiceOpen(false), []);
  const retry = useCallback((text: string) => sendRef.current(text, { retry: true }), []);

  // ---------- Ovozli boshqaruv (VoiceControl "Ovoz rejimi") ----------
  // Aytilgan savol chatga yuboriladi va javob yozilayotgan paytdayoq ovoz bilan o'qiladi
  const messagesRef = useRef(messages);
  const newChatRef = useRef(newChat);
  useEffect(() => {
    messagesRef.current = messages;
    newChatRef.current = newChat;
  });
  useEffect(() => {
    const offAsk = onChatAsk((text) => {
      if (streamingRef.current) return; // oldingi javob hali kelmoqda
      const voice = createSpeechStream();
      sendRef.current(text, { voice: true, onDelta: (t) => voice.push(t) }).then((answer) =>
        answer ? voice.end(answer) : (voice.stop(), speak("Javob olinmadi. Savolni qayta ayting", { quick: true }))
      );
    });
    const offAction = onVoiceAction((action) => {
      if (action === "stop") {
        abortRef.current?.abort();
        stopSpeaking();
      } else if (action === "read") {
        const last = [...messagesRef.current].reverse().find((m) => m.role === "assistant" && !m.error && m.content);
        speak(last ? last.content : "Hali javob yo'q. Savolingizni ayting");
      } else if (action === "new-chat") newChatRef.current();
      else if (action === "voice-chat") setVoiceOpen(true);
    });
    return () => {
      offAsk();
      offAction();
    };
  }, []);

  const removeConversation = async (id: number) => {
    try {
      await deleteConversation(id);
      if (activeId === id) newChat();
      refreshList();
      toast.success("Suhbat o'chirildi");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  const activeTitle = conversations.data?.find((c) => c.id === activeId)?.title ?? "Yangi suhbat";
  const role = user?.role ?? "student";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button onClick={newChat} className="btn-primary w-full">
          <MessageSquarePlus className="size-5" aria-hidden /> Yangi suhbat
        </button>
      </div>
      <nav aria-label="Suhbatlar" className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {conversations.isLoading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-9" />
            ))}
          </div>
        ) : !conversations.data?.length ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500">Hali suhbat yo&apos;q</p>
        ) : (
          conversations.data.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-xl transition-colors ${c.id === activeId ? "bg-indigo-50" : "hover:bg-slate-100"}`}
            >
              <button
                onClick={() => openConversation(c.id)}
                aria-current={c.id === activeId ? "true" : undefined}
                className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm ${c.id === activeId ? "font-semibold text-indigo-700" : "text-slate-700"}`}
              >
                {c.title}
              </button>
              <button
                onClick={() => setDeleting(c.id)}
                className="icon-btn mr-1 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-600"
                aria-label={`"${c.title}" suhbatini o'chirish`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </nav>
    </div>
  );

  return (
    <div className="card flex h-[calc(100dvh-8.5rem)] overflow-hidden lg:h-[calc(100dvh-10rem)]">
      {/* Suhbatlar ro'yxati: kompyuterda doimiy, telefonda ochiladigan */}
      <aside className="hidden w-72 shrink-0 border-r border-line bg-slate-50/60 md:block">{sidebar}</aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] animate-slide-up bg-surface shadow-2xl">
            <div className="flex justify-end p-2">
              <button onClick={() => setSidebarOpen(false)} className="icon-btn" aria-label="Yopish">
                <X className="size-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="icon-btn md:hidden" aria-label="Suhbatlar ro'yxati">
            <PanelLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-semibold">{activeTitle}</h1>
          <button onClick={() => setVoiceOpen(true)} className="btn-primary px-3 py-2 text-sm" disabled={streaming}>
            <AudioLines className="size-4" aria-hidden />
            <span className="max-sm:hidden">Ovozli suhbat</span>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto" aria-live="polite">
          {loadingConv ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-7 animate-spin text-indigo-500" aria-label="Yuklanmoqda" />
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                <Sparkles className="size-8" aria-hidden />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Salom, {user?.full_name.split(" ")[0]}! Nima haqida gaplashamiz?</h2>
              <p className="mt-2 text-slate-500">Savolingizni yozing yoki <AudioLines className="mx-1 inline size-[1.1em] align-[-0.15em] text-indigo-600" aria-hidden /><b>Ovozli suhbat</b> bilan gaplashing</p>
              <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                {SUGGESTIONS[role].map((s) => (
                  <button key={s} onClick={() => send(s)} className="card card-hover p-4 text-left text-sm font-medium text-slate-700">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m, i) => (
                <MessageItem
                  key={i}
                  m={m}
                  userName={user?.full_name ?? "?"}
                  canRetry={Boolean(m.retryOf) && i === messages.length - 1 && !streaming}
                  onRetry={retry}
                />
              ))}
            </div>
          )}
        </div>

        {/* Yozish maydoni */}
        <div className="border-t border-line bg-surface/80 p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-line bg-surface p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-200"
          >
            <button
              type="button"
              onClick={dictate}
              disabled={dictating || streaming}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${dictating ? "animate-pulse bg-red-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              aria-label="Ovoz bilan yozish"
              title="Ovoz bilan yozish"
            >
              <Mic className="size-5" />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={dictating ? "Tinglayapman..." : "Savolingizni yozing..."}
              aria-label="Xabar"
              className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 outline-none placeholder:text-slate-400"
            />
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
                aria-label="To'xtatish"
                title="To'xtatish"
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25 disabled:opacity-40"
                aria-label="Yuborish"
              >
                <Send className="size-4" />
              </button>
            )}
          </form>
          <p className="mt-2 text-center text-xs text-slate-400">AI xato qilishi mumkin — muhim ma&apos;lumotlarni o&apos;qituvchingiz bilan tekshiring.</p>
        </div>
      </section>

      {voiceOpen && <VoiceChat onSend={voiceSend} onClose={closeVoice} />}

      <ConfirmModal
        open={deleting !== null}
        title="Suhbatni o'chirish"
        message="Bu suhbat va undagi barcha xabarlar o'chiriladi."
        onConfirm={() => deleting !== null && removeConversation(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
