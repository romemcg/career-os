"use client";

import { BookUser, FileText, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Only modules that are implemented appear here. Later milestones add entries.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/career", label: "Career Profile", icon: BookUser, exact: true },
  { href: "/career/sources", label: "Sources & Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  if (item.href === "/career") return pathname === "/career" || pathname.startsWith("/career/facts");
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await api("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-surface-muted text-accent" : "text-fg-muted hover:bg-surface-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface lg:flex">
        <div className="px-6 py-5 text-lg font-semibold tracking-tight">CareerOS</div>
        {nav}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="font-semibold">CareerOS</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="rounded-lg p-2 hover:bg-surface-muted"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && (
        <div id="mobile-nav" className="flex flex-col border-b border-border bg-surface lg:hidden">
          {nav}
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
