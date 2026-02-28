"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const [isReady, setIsReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        throw loginError;
      }

      if (!data.session) {
        throw new Error("Sign-in completed without a session.");
      }

      const syncResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        }),
      });

      if (!syncResponse.ok) {
        const payload = (await syncResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to finalize your login session.");
      }

      toast.success("Welcome back.");
      window.location.assign(redirectTo);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to sign in.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : `Unable to sign in with ${provider}.`;
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  }

  return (
    <main className="page-fade flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel-card w-full max-w-md p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">Access</p>
        <h1 className="font-heading mt-3 text-3xl font-semibold">Log in to SolidDark</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Sign in to manage continuity, compliance, insurance prep, and the Soul.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleEmailLogin}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="field-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="field-base" />
          </div>
          {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}
          <Button type="submit" disabled={!isReady || isLoading} className="w-full bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            {isLoading ? "Signing in..." : "Log In"}
          </Button>
        </form>

        <div className="mt-6 grid gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!isReady || isLoading}
            onClick={() => void handleOAuth("google")}
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isReady || isLoading}
            onClick={() => void handleOAuth("github")}
            className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
          >
            <Github className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>
        </div>

        <p className="mt-6 text-sm text-[var(--text-secondary)]">
          New here?{" "}
          <Link href="/signup" className="font-medium text-[var(--accent-cyan)]">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
