import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  danger: "border-danger/30 bg-danger-bg text-danger",
  success: "border-success/30 bg-success-bg text-success",
  info: "border-border bg-surface-muted text-fg",
};

export function Alert({ tone = "info", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-lg border px-3 py-2 text-sm", tones[tone])}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-md text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
