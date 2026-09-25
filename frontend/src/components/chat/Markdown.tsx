import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown har bir elementga "node" uzatadi — uni HTML'ga yoymaslik uchun olib tashlaymiz
function clean<T extends { node?: unknown }>(props: T) {
  const { node, ...rest } = props;
  void node;
  return rest;
}

// AI javoblari uchun markdown (sarlavha, ro'yxat, qalin, kod, jadval) — Tailwind uslublari bilan
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (p) => <p className="my-2 leading-7 first:mt-0 last:mb-0" {...clean(p)} />,
        h1: (p) => <h3 className="mt-4 mb-2 text-lg font-bold" {...clean(p)} />,
        h2: (p) => <h3 className="mt-4 mb-2 text-lg font-bold" {...clean(p)} />,
        h3: (p) => <h4 className="mt-3 mb-1.5 font-semibold" {...clean(p)} />,
        ul: (p) => <ul className="my-2 list-disc space-y-1 pl-6" {...clean(p)} />,
        ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-6" {...clean(p)} />,
        li: (p) => <li className="leading-7" {...clean(p)} />,
        strong: (p) => <strong className="font-semibold text-slate-900" {...clean(p)} />,
        a: (p) => <a className="text-indigo-600 underline" target="_blank" rel="noreferrer" {...clean(p)} />,
        blockquote: (p) => <blockquote className="my-2 border-l-4 border-indigo-200 pl-4 text-slate-600" {...clean(p)} />,
        // Blok kod (```) — className bor ("language-..."), qatordagi kod — yo'q
        code: (p) => {
          const { className, children, ...rest } = clean(p);
          return className ? (
            <code className={`${className} block`} {...rest}>
              {children}
            </code>
          ) : (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em]" {...rest}>
              {children}
            </code>
          );
        },
        pre: (p) => <pre className="my-3 overflow-x-auto rounded-xl bg-gray-900 p-4 font-mono text-sm text-gray-100" {...clean(p)} />,
        table: (p) => (
          <div className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm" {...clean(p)} />
          </div>
        ),
        th: (p) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold" {...clean(p)} />,
        td: (p) => <td className="border border-slate-200 px-3 py-2" {...clean(p)} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
