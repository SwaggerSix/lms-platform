"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar, Clock, MapPin, Video, FileText, ClipboardCheck, Users,
  Loader2, GraduationCap, Download, CheckCircle2, ClipboardList,
  FileSignature, ExternalLink,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location_type: string;
  location_details: string | null;
  meeting_url: string | null;
  max_capacity: number;
  status: string;
  recording_url: string | null;
  my_registration: { registration_status: string; attendance_status: string | null } | null;
}

interface Material {
  id: string;
  title: string;
  resource_type: string;
  audience: string;
  file_url: string;
  file_name: string | null;
}

interface Exam {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  question_count: number | null;
}

interface Survey {
  id: string;
  name: string;
  level: number | null;
  provider: string | null;
  status: "pending" | "completed" | "expired";
  due_at: string | null;
  completed_at: string | null;
}

interface ClassData {
  class: {
    id: string;
    title: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    instructor_name: string | null;
    instructor_bio: string | null;
  };
  course: { title: string; slug: string } | null;
  contract: { number: string | null; url: string | null; file_name: string | null } | null;
  sessions: Session[];
  materials: Material[];
  exams: Exam[];
  surveys: Survey[];
  participant_count: number;
  can_manage: boolean;
}

export default function ClassCardClient({ classId }: { classId: string }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const register = async (sessionId: string) => {
    setRegistering(sessionId);
    try {
      await fetch("/api/ilt-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, action: "register" }),
      });
      await load();
    } finally {
      setRegistering(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-500">Class not found.</div>;
  }

  const { class: cls, course, contract, sessions, materials, exams, surveys, participant_count } = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{course?.title}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{cls.title}</h1>
            {cls.description && <p className="mt-2 text-sm text-gray-600">{cls.description}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium capitalize text-indigo-700">
            {cls.status.replace("_", " ")}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
          {cls.start_date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(cls.start_date).toLocaleDateString()}
              {cls.end_date ? ` – ${new Date(cls.end_date).toLocaleDateString()}` : ""}
            </span>
          )}
          {cls.instructor_name && (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" />
              {cls.instructor_name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {participant_count} enrolled
          </span>
        </div>
      </div>

      {/* Contract — admins only (the API omits this for everyone else) */}
      {contract && (contract.number || contract.url) && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="text-indigo-600"><FileSignature className="h-4 w-4" /></span>
            Contract
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Admin only</span>
          </h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              {contract.number && (
                <p className="text-sm text-gray-700">
                  Contract #: <span className="font-medium">{contract.number}</span>
                </p>
              )}
              {contract.file_name && <p className="text-xs text-gray-400">{contract.file_name}</p>}
            </div>
            {contract.url && (
              <a
                href={contract.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in SharePoint
              </a>
            )}
          </div>
        </section>
      )}

      {/* Sessions */}
      <Section icon={<Calendar className="h-4 w-4" />} title="Sessions" count={sessions.length}>
        {sessions.length === 0 ? (
          <Empty>No sessions scheduled yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => {
              const registered = s.my_registration?.registration_status === "registered";
              const waitlisted = s.my_registration?.registration_status === "waitlisted";
              const isVirtual = s.location_type !== "in_person";
              return (
                <li key={s.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{s.title}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(s.session_date).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {s.start_time}–{s.end_time} {s.timezone}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {isVirtual ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                          {isVirtual ? "Virtual" : s.location_details || "In person"}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {s.status === "cancelled" ? (
                        <span className="text-xs text-red-600">Cancelled</span>
                      ) : registered || waitlisted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          {waitlisted ? "Waitlisted" : "Registered"}
                        </span>
                      ) : (
                        <button
                          onClick={() => register(s.id)}
                          disabled={registering === s.id}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {registering === s.id ? "..." : "Register"}
                        </button>
                      )}
                    </div>
                  </div>
                  {registered && isVirtual && s.meeting_url && (
                    <a
                      href={s.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Video className="h-3.5 w-3.5" /> Join meeting
                    </a>
                  )}
                  {s.recording_url && (
                    <a
                      href={s.recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 ml-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Video className="h-3.5 w-3.5" /> Recording
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Materials */}
      <Section icon={<FileText className="h-4 w-4" />} title="Materials" count={materials.length}>
        {materials.length === 0 ? (
          <Empty>No materials posted yet.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{m.title}</span>
                  {m.audience === "facilitator" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Facilitator</span>
                  )}
                </div>
                <a
                  href={`/api/course-resources/${m.id}/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Exams */}
      <Section icon={<ClipboardCheck className="h-4 w-4" />} title="Exams & Assessments" count={exams.length}>
        {exams.length === 0 ? (
          <Empty>No assessments for this class.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {exams.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-gray-700">{e.title}</p>
                  <p className="text-xs text-gray-400">
                    {e.question_count ? `${e.question_count} questions · ` : ""}Pass: {e.passing_score}%
                  </p>
                </div>
                <Link
                  href={`/learn/assessments/${e.id}?class_id=${cls.id}`}
                  className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  Start
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Surveys — SurveyCraft-backed training evaluations for this class's course */}
      <Section icon={<ClipboardList className="h-4 w-4" />} title="Surveys" count={surveys.length}>
        {surveys.length === 0 ? (
          <Empty>No surveys assigned yet. They appear here when triggered for this class.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {surveys.map((s) => {
              const done = s.status === "completed";
              return (
                <li key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm text-gray-700">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {done
                        ? `Completed${s.completed_at ? ` ${new Date(s.completed_at).toLocaleDateString()}` : ""}`
                        : s.due_at
                        ? `Due ${new Date(s.due_at).toLocaleDateString()}`
                        : "Pending"}
                    </p>
                  </div>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Submitted
                    </span>
                  ) : (
                    <Link
                      href="/learn/evaluations"
                      className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                    >
                      Take survey
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon, title, count, children,
}: {
  icon: React.ReactNode; title: string; count: number; children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="text-indigo-600">{icon}</span>
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-gray-400">{children}</p>;
}
