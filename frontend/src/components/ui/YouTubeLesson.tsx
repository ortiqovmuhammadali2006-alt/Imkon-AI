"use client";

import { useEffect, useRef, useState } from "react";
import { Captions } from "lucide-react";
import { parseYoutubeId } from "@/lib/youtube";
import { onVoiceAction } from "@/lib/speech";

type Segment = { start: number; end: number; text: string };

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

// YouTube video darslik: subtitrlar yoqilgan pleyer (maxfiylik rejimi — youtube-nocookie) + sinxron video matni.
// Matndagi qatorni bossangiz — video o'sha joydan boshlanadi; hozir aytilayotgan qator ajratib ko'rsatiladi (eshitishi cheklanganlar uchun).
// Ovoz: "Imkon, video" — ijro, "Imkon, to'xta" — pauza
export default function YouTubeLesson({ url, title, segments = [] }: { url: string; title?: string | null; segments?: Segment[] }) {
  const id = parseYoutubeId(url);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [time, setTime] = useState(0);
  const [showText, setShowText] = useState(false);

  const command = (func: string, args: unknown[] = []) =>
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  // Pleyerdan joriy vaqtni olish (IFrame API xabarlari)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const t = data?.info?.currentTime;
        if (typeof t === "number") setTime(t);
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(
    () =>
      onVoiceAction((action) => {
        if (action === "video") {
          frameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          command("playVideo");
        } else if (action === "stop") command("pauseVideo");
      }),
    []
  );

  const current = segments.findIndex((s) => time >= s.start && time < Math.max(s.end, s.start + 0.5));
  useEffect(() => {
    if (!showText || current < 0) return;
    listRef.current?.children[current]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current, showText]);

  if (!id) return null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const src =
    `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0&cc_load_policy=1&cc_lang_pref=uz&hl=uz` +
    (origin ? `&origin=${encodeURIComponent(origin)}` : "");

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-900 shadow-md">
        <iframe
          ref={frameRef}
          src={src}
          onLoad={() => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), "*")}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title ? `Video dars: ${title}` : "Video dars"}
        />
      </div>

      {segments.length > 0 && (
        <div>
          <button onClick={() => setShowText((v) => !v)} className="btn-secondary px-3 py-2 text-sm" aria-expanded={showText}>
            <Captions className="size-4" aria-hidden /> {showText ? "Video matnini yashirish" : "Video matnini ko'rsatish"}
          </button>
          {showText && (
            <ol ref={listRef} className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-lg border border-line p-2" aria-label="Video matni">
              {segments.map((s, i) => (
                <li key={i}>
                  <button
                    onClick={() => command("seekTo", [s.start, true])}
                    className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                      i === current ? "bg-indigo-100 text-indigo-900" : "hover:bg-slate-100"
                    }`}
                  >
                    <span className="w-12 shrink-0 font-mono text-sm text-slate-500">{clock(s.start)}</span>
                    <span className="text-slate-800">{s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
