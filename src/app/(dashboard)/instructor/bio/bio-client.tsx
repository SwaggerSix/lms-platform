"use client";

import { useState } from "react";
import { UserCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const MAX_BIO = 2000;

export default function BioClient({
  initialBio,
  name,
}: {
  initialBio: string;
  name: string;
}) {
  const toast = useToast();
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const dirty = bio !== initialBio;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save bio");
      }
      toast.success("Your bio has been saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save bio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <UserCircle className="h-6 w-6 text-indigo-600" />
          My Bio
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Tell learners about yourself{name ? `, ${name}` : ""}. Your bio appears
          wherever you&apos;re shown as an instructor — on course pages and
          instructor-led session listings.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="instructor-bio"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Bio
        </label>
        <textarea
          id="instructor-bio"
          value={bio}
          maxLength={MAX_BIO}
          onChange={(e) => setBio(e.target.value)}
          rows={8}
          placeholder="Share your background, expertise, and teaching style…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {bio.length}/{MAX_BIO}
          </span>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : "Save Bio"}
          </button>
        </div>
      </div>
    </div>
  );
}
