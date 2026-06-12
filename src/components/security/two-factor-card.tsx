"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

type Phase = "loading" | "disabled" | "enrolling" | "enabled";

/**
 * Self-contained TOTP enrollment card for the Security settings tab, built on
 * Supabase Auth's native MFA. Enrollment, challenge, and verification all talk
 * to Supabase directly from the browser; no secrets touch our own backend.
 */
export function TwoFactorCard() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFactors = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setPhase("disabled");
      return;
    }
    const verified = data.all.find(
      (f) => f.factor_type === "totp" && f.status === "verified"
    );
    if (verified) {
      setFactorId(verified.id);
      setPhase("enabled");
    } else {
      setPhase("disabled");
    }
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Clear out abandoned half-finished enrollments so a fresh QR is issued.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? "Could not start 2FA setup.");
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode("");
    setPhase("enrolling");
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setBusy(false);
      setError(challengeError?.message ?? "Could not verify the code.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't match. Check your authenticator app and try again.");
      return;
    }
    setQrCode(null);
    setSecret(null);
    setCode("");
    setPhase("enabled");
  };

  const cancelEnrollment = async () => {
    setBusy(true);
    setError(null);
    if (factorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setBusy(false);
    setPhase("disabled");
  };

  const disable = async () => {
    if (!factorId) return;
    if (
      !window.confirm(
        "Disable two-factor authentication? Your account will be protected by your password only."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    setFactorId(null);
    setPhase("disabled");
  };

  const qrSrc = qrCode
    ? qrCode.startsWith("data:")
      ? qrCode
      : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
      <p className="mt-1 text-sm text-gray-500">
        Add an extra layer of security to your account with an authenticator app
        (Google Authenticator, Microsoft Authenticator, 1Password, etc.).
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {phase === "loading" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking status…
        </div>
      )}

      {phase === "disabled" && (
        <div className="mt-4 flex items-center gap-4">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
            Not enabled
          </span>
          <button
            onClick={startEnrollment}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <ShieldCheck className="h-4 w-4" />
            Enable 2FA
          </button>
        </div>
      )}

      {phase === "enrolling" && (
        <form onSubmit={confirmEnrollment} className="mt-4 space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>Open your authenticator app and scan this QR code.</li>
            <li>Enter the 6-digit code the app shows to finish setup.</li>
          </ol>
          {qrSrc && (
            <div className="flex items-start gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt="QR code for authenticator app"
                className="h-44 w-44 rounded-lg border border-gray-200 bg-white p-2"
              />
              {secret && (
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-700">Can&apos;t scan it?</p>
                  <p className="mt-1">Enter this key manually:</p>
                  <code className="mt-1 inline-block rounded bg-gray-100 px-2 py-1 font-mono text-xs tracking-wider text-gray-800">
                    {secret}
                  </code>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="123456"
              className="block w-36 rounded-lg border border-gray-300 px-4 py-2.5 text-center font-mono text-base tracking-[0.3em] text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify &amp; enable
            </button>
            <button
              type="button"
              onClick={cancelEnrollment}
              disabled={busy}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {phase === "enabled" && (
        <div className="mt-4 flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            <ShieldCheck className="h-4 w-4" /> Enabled
          </span>
          <button
            onClick={disable}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            <ShieldOff className="h-4 w-4" />
            Disable
          </button>
        </div>
      )}
    </div>
  );
}
