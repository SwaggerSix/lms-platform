"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff, Loader2, Building2, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // SSO state
  const [ssoMode, setSsoMode] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoProviderName, setSsoProviderName] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        return;
      }

      // Set the Supabase session using the tokens from the API
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      router.push("/dashboard");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSsoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSsoLoading(true);

    try {
      const domain = ssoEmail.split("@")[1]?.toLowerCase();
      if (!domain) {
        setError("Please enter a valid email address.");
        setSsoLoading(false);
        return;
      }

      // Check if domain has an active SSO provider
      const res = await fetch(`/api/sso/check-domain?domain=${encodeURIComponent(domain)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to check SSO configuration.");
        setSsoLoading(false);
        return;
      }

      if (!data.has_sso) {
        setError(
          `No SSO provider is configured for "${domain}". Please use email and password to sign in.`
        );
        setSsoLoading(false);
        return;
      }

      setSsoProviderName(data.provider_name);

      // Initiate SSO sign-in via Supabase Auth
      const supabase = createClient();
      const { error: ssoError } = await supabase.auth.signInWithSSO({
        domain,
      });

      if (ssoError) {
        setError(ssoError.message);
        setSsoLoading(false);
        return;
      }

      // Supabase will handle the redirect to the IdP automatically.
      // The user will be redirected back to /api/auth/callback after SAML assertion.
    } catch {
      setError("An unexpected error occurred during SSO login.");
      setSsoLoading(false);
    }
  };

  if (ssoMode) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LearnHub</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in with SSO</p>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* SSO Form */}
        <form onSubmit={handleSsoSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="sso-email"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Work email address
            </label>
            <input
              id="sso-email"
              type="email"
              value={ssoEmail}
              onChange={(e) => {
                setSsoEmail(e.target.value);
                setSsoProviderName(null);
              }}
              required
              placeholder="you@company.com"
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Enter your work email and we will redirect you to your company&apos;s login page.
            </p>
          </div>

          {ssoProviderName && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
              Redirecting to <strong>{ssoProviderName}</strong>...
            </div>
          )}

          <button
            type="submit"
            disabled={ssoLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ssoLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue with SSO
          </button>
        </form>

        {/* Back to regular login */}
        <button
          type="button"
          onClick={() => {
            setSsoMode(false);
            setError(null);
            setSsoProviderName(null);
          }}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to email login
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">LearnHub</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in to your account
        </p>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign In
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Register
        </Link>
      </p>

      {/* Legal Links */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Link href="/privacy" className="hover:text-gray-600">
          Privacy Policy
        </Link>
        <span>|</span>
        <Link href="/terms" className="hover:text-gray-600">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
