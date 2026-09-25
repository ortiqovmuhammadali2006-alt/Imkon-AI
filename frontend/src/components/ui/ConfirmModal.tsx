"use client";

import { Loader2 } from "lucide-react";
import Modal from "./Modal";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "O'chirish",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Bekor qilish
        </button>
        <button onClick={onConfirm} disabled={loading} className="btn-danger">
          {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
