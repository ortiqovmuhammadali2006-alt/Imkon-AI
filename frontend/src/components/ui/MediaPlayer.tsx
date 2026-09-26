"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, CaptionsOff, Gauge } from "lucide-react";
import { fileUrl } from "@/lib/api";

export type Segment = { start: number; end: number; text: string };

const SPEEDS = [0.75, 1, 1.25, 1.5];

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Video/audio pleyer: subtitr (VTT), jonli yozuv, tezlik va sinxron matn (bosilsa — o'sha joyga o'tadi)
export default function MediaPlayer({
  url,
  name,
  subtitleUrl,
  segments = [],
}: {
  url: string;
  name: string;
  subtitleUrl?: string | null;
  segments?: Segment[];
}) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isVideo = ["mp4", "webm"].includes(ext);
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(true);

  const active = segments.findIndex((s) => time >= s.start && time < s.end);
  const liveText = active >= 0 ? segments[active].text : "";

  // Video ichidagi subtitrni yoqish/o'chirish
  useEffect(() => {
    const track = mediaRef.current?.textTracks?.[0];
    if (track) track.mode = captionsOn ? "showing" : "hidden";
  }, [captionsOn, subtitleUrl]);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  }, [speed]);

  // Joriy bo'lakni ro'yxat ichida ko'rinadigan joyga suramiz (sahifaning o'zi qimirlamaydi)
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (list && item) list.scrollTo({ top: item.offsetTop - list.clientHeight / 2, behavior: "smooth" });
  }, [active]);

  const seek = (t: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = t;
    mediaRef.current.play().catch(() => {});
  };

  const src = fileUrl(url);
  const track = subtitleUrl ? (
    <track kind="captions" src={fileUrl(subtitleUrl)} srcLang="uz" label="O'zbekcha" default />
  ) : null;

  return (
    <div className="space-y-3">
      {isVideo ? (
        <video
          ref={mediaRef}
          controls
          crossOrigin="anonymous"
          src={src}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          className="max-h-[28rem] w-full rounded-2xl bg-black"
        >
          {track}
        </video>
      ) : (
        <audio
          ref={mediaRef}
          controls
          crossOrigin="anonymous"
          src={src}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          className="w-full"
        >
          {track}
        </audio>
      )}

      {/* Audio uchun jonli yozuv (video subtitri pleyerning o'zida chiqadi) */}
      {!isVideo && captionsOn && segments.length > 0 && (
        <p aria-live="polite" className="min-h-[3.5rem] rounded-2xl bg-gray-900 px-5 py-3 text-center text-lg font-medium text-white">
          {liveText || "…"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {segments.length > 0 && (
          <button
            type="button"
            onClick={() => setCaptionsOn((v) => !v)}
            aria-pressed={captionsOn}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {captionsOn ? <Captions className="size-4" aria-hidden /> : <CaptionsOff className="size-4" aria-hidden />}
            Subtitr: {captionsOn ? "yoniq" : "o'chiq"}
          </button>
        )}
        <div role="group" aria-label="Tezlik" className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <Gauge className="mx-1 size-4 text-slate-500" aria-hidden />
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`rounded-lg px-2.5 py-1 text-sm font-medium ${speed === s ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {segments.length > 0 && (
        <details open className="rounded-2xl ring-1 ring-line">
          <summary className="cursor-pointer px-4 py-3 font-semibold">Matni (bosilgan joydan eshittiriladi)</summary>
          <ol ref={listRef} className="relative max-h-72 space-y-1 overflow-y-auto border-t border-line p-2">
            {segments.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => seek(s.start)}
                  aria-current={i === active ? "true" : undefined}
                  className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    i === active ? "bg-indigo-50 text-indigo-900" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="w-12 shrink-0 font-mono text-xs leading-6 text-slate-500">{clock(s.start)}</span>
                  <span className="leading-6">{s.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}

      <a href={src} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
        {name} — yuklab olish
      </a>
    </div>
  );
}
