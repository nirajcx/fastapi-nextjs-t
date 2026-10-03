"use client";
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { Toast, useToastStore } from "@/store/useToastStore";

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.kind === "error" ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.kind, dismiss]);
  const Icon = toast.kind === "error" ? AlertCircle : toast.kind === "info" ? Info : CheckCircle2;
  return <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
    <Icon size={20} aria-hidden="true" /><span>{toast.message}</span>
    <button aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={17} /></button>
  </div>;
}
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return <section className="toaster" aria-label="Notifications">{toasts.map((toast) => <ToastItem key={toast.id} toast={toast} />)}</section>;
}
