import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth/server";
import { LoginForm } from "@/components/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentOwner()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">CareerOS</h1>
          <p className="text-sm text-fg-muted">Sign in to your private workspace</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
