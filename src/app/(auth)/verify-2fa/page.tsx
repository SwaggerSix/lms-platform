"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/**
 * Second login step for accounts with two-factor authentication enabled.
 * The middleware sends any password-only (aal1) session belonging to a user
 * with a verified TOTP factor here, and blocks the rest of the app (pages and
 * APIs) until the code is verified.
 */
export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFactor = async () => {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        return;
      }
      const verified = data.all.find(
        (f) => f.factor_type === "totp" && f.status === "verified"
      );
      if (!verified) {
        // No verified factor on this account — nothing to verify.
        router.replace("/dashboard");
        return;
      }
      setFactorId(verified.id);
    };
    loadFactor();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Could not verify the code.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError("That code didn't match. Check your authenticator app and try again.");
        setCode("");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Two-factor verification</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="totp-code"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Verification code
          </label>
          <input
            id="totp-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !factorId || code.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Verify
        </button>
      </form>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-6 w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        Sign out and use a different account
      </button>
    </div>
  );
}
