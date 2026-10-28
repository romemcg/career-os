import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireOwner } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  return <AppShell>{children}</AppShell>;
}
