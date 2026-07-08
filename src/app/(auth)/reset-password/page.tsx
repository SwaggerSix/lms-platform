"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// The recovery flow can land here in three shapes:
//   1. Implicit flow — Supabase has already redirected with the session in the
//      URL hash (#access_token=...). The browser client picks this up via
//      detectSessionInUrl and emits PASSWORD_RECOVERY / INITIAL_SESSION.
//   2. A `?code=` (PKCE) param that must be exchanged for a session.
//   3. A `?token_hash=&type=recovery` pair that must be verified via verifyOtp.
// Cases 2 and 3 are handled here so the email template can be switched to the
// scanner-resistant token_hash form without further code changes. We only
// exchange/verify on an explicit user action (form submit), never on page load,
// so corporate email link-scanners that merely GET the page cannot consume the
// one-time token.
type Phase = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  // Reads any one-time credential the email link may have left in the URL.
  const readLinkParams = useCallback(() => {
    if (typeof window === "undefined") {
      return { code: null, tokenHash: null, type: null, hashError: null };
    }
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return {
      code: query.get("code"),
      tokenHash: query.get("token_hash") ?? hash.get("token_hash"),
      type: query.get("type") ?? hash.get("type"),
      // Supabase reports expired/consumed links via the hash, e.g.
      // #error=access_denied&error_code=otp_expired
      hashError: hash.get("error_code") ?? hash.get("error"),
    };
  }, []);

  // Decide whether the user arrived with a usable recovery session. We trust an
  // already-established session (implicit flow) or the presence of a code /
  // token_hash we can act on at submit time. A hash error, or nothing at all,
  // means the link was already used or expired.
  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setPhase("ready");
    });

    (async () => {
      const { code, tokenHash, hashError } = readLinkParams();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;

      if (session || code || tokenHash) {
        setPhase("ready");
        return;
      }

      if (hashError) {
        setPhase("invalid");
        return;
      }

      // detectSessionInUrl resolves asynchronously; give the auth-state listener
      // a brief window to surface an implicit-flow session before giving up.
      setTimeout(async () => {
        if (!active) return;
        const {
          data: { session: late },
        } = await supabase.auth.getSession();
        setPhase(late ? "ready" : "invalid");
      }, 1500);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, readLinkParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Establish the session from a code / token_hash now (on user action) if
      // detectSessionInUrl didn't already do it for the implicit flow.
      const { code, tokenHash, type } = readLinkParams();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session && code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setPhase("invalid");
          return;
        }
      } else if (!session && tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as "recovery") || "recovery",
        });
        if (verifyError) {
          setPhase("invalid");
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        // AuthSessionMissingError surfaces here when the recovery link was
        // already consumed (e.g. by an email security scanner) before the user
        // reached this page. Translate it into actionable guidance.
        if (
          updateError.name === "AuthSessionMissingError" ||
          /session missing/i.test(updateError.message)
        ) {
          setPhase("invalid");
          return;
        }
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-200">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Reset Your Password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your new password below
        </p>
      </div>

      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Password Updated</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your password has been reset successfully. Redirecting to login...
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : phase === "checking" ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          <p className="mt-3 text-sm text-gray-500">Verifying your reset link...</p>
        </div>
      ) : phase === "invalid" ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            This reset link is no longer valid
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Your password reset link has expired or has already been used. This can
            happen when an email security scanner opens the link before you do.
            Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            Request a new reset link
          </Link>
          <p className="mt-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <>
          {/* Error */}
          {error && (
            <div role="alert" className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter your password"
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset Password
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
