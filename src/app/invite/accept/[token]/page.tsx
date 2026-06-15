"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface InviteInfo {
  valid: boolean;
  reason?: string;
  email?: string;
  invited_role?: string;
  class_title?: string | null;
  course_title?: string | null;
  is_new_user?: boolean;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = String(params.token);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [inviteRes, meRes] = await Promise.all([
          fetch(`/api/classes/invite/${token}`),
          fetch("/api/auth/me"),
        ]);
        setInfo(await inviteRes.json());
        setAuthed(meRes.ok);
      } catch {
        setError("Something went wrong loading your invitation.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/classes/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not accept the invitation.");
        return;
      }
      router.push(`/learn/classes/${data.class_id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const reasonText: Record<string, string> = {
    not_found: "This invitation link is invalid.",
    expired: "This invitation has expired. Ask your instructor to resend it.",
    revoked: "This invitation has been revoked.",
    accepted: "This invitation has already been accepted.",
  };

  const redirectTarget = `/invite/accept/${token}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Class Invitation</h1>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && info && !info.valid && (
          <div className="text-center">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="text-sm text-gray-600">{reasonText[info.reason ?? ""] ?? "This invitation is no longer valid."}</p>
            <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Go to sign in
            </Link>
          </div>
        )}

        {!loading && info?.valid && (
          <div className="text-center">
            <p className="mb-1 text-sm text-gray-500">You've been invited to join</p>
            <p className="mb-1 text-lg font-semibold text-gray-900">{info.class_title}</p>
            {info.course_title && info.course_title !== info.class_title && (
              <p className="mb-4 text-sm text-gray-500">{info.course_title}</p>
            )}
            <p className="mb-6 text-sm text-gray-500">
              as {info.invited_role === "instructor" ? "an instructor" : info.invited_role === "observer" ? "an observer" : "a participant"}
              {info.email ? ` · ${info.email}` : ""}
            </p>

            {authed ? (
              <button
                onClick={accept}
                disabled={accepting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Accept &amp; Join
              </button>
            ) : info.is_new_user ? (
              <Link
                href={`/register?redirect=${encodeURIComponent(redirectTarget)}&email=${encodeURIComponent(info.email ?? "")}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Create account to join
              </Link>
            ) : (
              <Link
                href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Sign in to join
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
