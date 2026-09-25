const COLORS: Record<number, string> = {
  1: "border-red-500 bg-red-500",
  2: "border-orange-500 bg-orange-500",
  3: "border-amber-500 bg-amber-500",
  4: "border-lime-600 bg-lime-600",
  5: "border-emerald-600 bg-emerald-600",
};

// 1–5 baho tanlash tugmalari
export default function ScorePicker({
  value,
  onChange,
  label = "Baho",
}: {
  value: number | null;
  onChange: (score: number) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`size-11 rounded-lg border-2 text-lg font-bold transition-colors ${
            value === n ? `${COLORS[n]} text-white` : "border-slate-300 text-slate-600 hover:border-slate-400"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400">—</span>;
  return (
    <span className={`inline-flex size-8 items-center justify-center rounded-lg font-bold text-white ${COLORS[Math.round(score)]}`}>
      {score}
    </span>
  );
}
