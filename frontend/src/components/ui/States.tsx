import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-8 animate-spin text-indigo-600" aria-label="Yuklanmoqda" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-red-50 px-6 py-12 text-center text-red-700">
      <AlertCircle className="mb-2 size-8" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Inbox className="mb-3 size-10 text-slate-400" aria-hidden />
      <p className="text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
