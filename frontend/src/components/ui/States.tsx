import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";

// Yuklanish paytida sahifa shaklidagi "skelet" bloklar
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Yuklanmoqda" className="animate-fade-in space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card flex items-center gap-4 p-5">
            <div className="skeleton size-12 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-2/5" />
              <div className="skeleton h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Yuklanmoqda...</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="flex animate-fade-in flex-col items-center rounded-2xl border border-red-100 bg-red-50/70 px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-red-100 p-3 text-red-600">
        <AlertCircle className="size-7" aria-hidden />
      </div>
      <p className="font-medium text-red-800">Xatolik yuz berdi</p>
      <p className="mt-1 text-red-700/80">{message}</p>
    </div>
  );
}

export function EmptyState({
  message,
  action,
  icon: Icon = Inbox,
}: {
  message: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 p-4 text-indigo-500">
        <Icon className="size-9" aria-hidden />
      </div>
      <p className="max-w-sm text-slate-600">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 sm:flex">
            <Icon className="size-6" aria-hidden />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
