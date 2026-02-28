"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const [isReady, setIsReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (signupError) {
        throw signupError;
      }

      setMessage("Check your email to verify your account before logging in.");
      toast.success("Account created. Check your email for verification.");
      router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError.message : "Unable to create your account.";
      setError(nextError);
      toast.error(nextError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-fade flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel-card w-full max-w-md p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--accent-cyan)]">Start</p>
        <h1 className="font-heading mt-3 text-3xl font-semibold">Create your protection stack</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Set up your workspace and start building with some legal and operational cover.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSignup}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required className="field-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="field-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className="field-base" />
          </div>
          {error ? <p className="text-sm text-[var(--accent-red)]">{error}</p> : null}
          {message ? <p className="text-sm text-[var(--accent-cyan)]">{message}</p> : null}
          <Button type="submit" disabled={!isReady || isLoading} className="w-full bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red)]/90">
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--accent-cyan)]">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
