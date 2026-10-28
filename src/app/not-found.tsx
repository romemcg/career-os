import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-fg-muted">This record does not exist or is not available to you.</p>
      <Link href="/dashboard" className={buttonClasses("secondary")}>
        Back to dashboard
      </Link>
    </main>
  );
}
