"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Users,
  CalendarDays,
  FolderOpen,
  ClipboardList,
  MessageSquare,
  Video,
  MapPin,
  Download,
  FileText,
  PlayCircle,
  FileQuestion,
  Clock,
  Loader2,
  CheckCircle2,
  Plus,
} from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  contentType: string;
  contentUrl: string | null;
  duration: number | null;
}
interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
interface SessionInfo {
  id: string;
  title: string;
  sessionDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  locationType: string | null;
  locationDetails: string | null;
  meetingUrl: string | null;
  status: string;
  maxCapacity: number | null;
  attendeeCount: number;
}
interface Participant {
  enrollmentId: string;
  userId: string | null;
  name: string;
  email: string;
  jobTitle: string;
  status: string;
  score: number | null;
}
interface EvaluationTemplate {
  id: string;
  name: string;
  level: number;
  description: string;
}
interface EvaluationTrigger {
  id: string;
  templateId: string;
  templateName: string;
  level: number | null;
  delayDays: number;
  isActive: boolean;
}

export interface ClassDetailData {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string;
    shortDescription: string;
    courseType: string;
    status: string;
    difficulty: string;
    estimatedDuration: number | null;
  };
  modules: Module[];
  sessions: SessionInfo[];
  participants: Participant[];
  evaluationTemplates: EvaluationTemplate[];
  evaluationTriggers: EvaluationTrigger[];
}

type Tab = "overview" | "participants" | "materials" | "evaluations";

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  enrolled: "bg-gray-100 text-gray-700",
  failed: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

function lessonIcon(type: string) {
  switch (type) {
    case "video":
      return PlayCircle;
    case "quiz":
      return FileQuestion;
    case "assignment":
      return ClipboardList;
    default:
      return FileText;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBD";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClassDetailClient({ data }: { data: ClassDetailData }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [messaging, setMessaging] = useState(false);

  // Evaluation deploy form
  const [triggers, setTriggers] = useState<EvaluationTrigger[]>(
    data.evaluationTriggers
  );
  const [templateId, setTemplateId] = useState("");
  const [delayDays, setDelayDays] = useState(0);
  const [deploying, setDeploying] = useState(false);

  const { course } = data;
  const participantIds = data.participants
    .map((p) => p.userId)
    .filter((id): id is string => Boolean(id));

  const messageClass = async () => {
    if (participantIds.length === 0) {
      toast.error("There are no participants to message yet.");
      return;
    }
    setMessaging(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_conversation",
          type: "group",
          title: course.title,
          participant_ids: participantIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start the conversation");
      }
      toast.success("Class conversation created.");
      router.push("/learn/messages");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to message the class");
    } finally {
      setMessaging(false);
    }
  };

  const deployEvaluation = async () => {
    if (!templateId) {
      toast.error("Choose an evaluation template to deploy.");
      return;
    }
    setDeploying(true);
    try {
      const res = await fetch("/api/evaluations/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: course.id,
          template_id: templateId,
          delay_days: delayDays,
          is_active: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to deploy evaluation");
      }
      const tpl = data.evaluationTemplates.find((t) => t.id === templateId);
      setTriggers((prev) => [
        {
          id: body.id ?? crypto.randomUUID(),
          templateId,
          templateName: tpl?.name ?? "Evaluation",
          level: tpl?.level ?? null,
          delayDays,
          isActive: true,
        },
        ...prev,
      ]);
      setTemplateId("");
      setDelayDays(0);
      toast.success("Evaluation deployed to this course.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to deploy evaluation");
    } finally {
      setDeploying(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { key: "overview", label: "Overview", icon: CalendarDays },
    { key: "participants", label: "Participants", icon: Users, count: data.participants.length },
    { key: "materials", label: "Materials", icon: FolderOpen },
    { key: "evaluations", label: "Evaluations", icon: ClipboardList, count: triggers.length },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/instructor/classes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to my classes
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
          {course.shortDescription && (
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {course.shortDescription}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {course.courseType.replace("_", " ")}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-600">
              {course.difficulty}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                STATUS_BADGE[course.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {course.status}
            </span>
          </div>
        </div>
        <button
          onClick={messageClass}
          disabled={messaging}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {messaging ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
          Message Class
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {typeof t.count === "number" && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          {course.description && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                About this course
              </h2>
              <p className="whitespace-pre-line text-sm text-gray-600">
                {course.description}
              </p>
            </section>
          )}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <CalendarDays className="h-4 w-4 text-indigo-600" />
              Scheduled sessions
            </h2>
            {data.sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                No sessions scheduled for this course yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{s.title}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(s.sessionDate)}
                          {s.startTime && ` · ${s.startTime}`}
                          {s.endTime && `–${s.endTime}`}
                          {s.timezone && ` ${s.timezone}`}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                          {s.locationType === "virtual" ? (
                            <Video className="h-3.5 w-3.5" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5" />
                          )}
                          {s.locationDetails ||
                            (s.locationType ? s.locationType : "Location TBD")}
                          {s.meetingUrl && (
                            <a
                              href={s.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              Join link
                            </a>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="h-3.5 w-3.5" />
                          {s.attendeeCount}
                          {s.maxCapacity ? ` / ${s.maxCapacity}` : ""} attending
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Participants */}
      {tab === "participants" && (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {data.participants.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              No participants are enrolled in this course yet.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.participants.map((p) => (
                  <tr key={p.enrollmentId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.email}</td>
                    <td className="px-4 py-3 text-gray-600">{p.jobTitle || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.score !== null ? `${p.score}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Materials */}
      {tab === "materials" && (
        <section className="space-y-4">
          {data.modules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              This course has no modules or materials yet.
            </p>
          ) : (
            data.modules.map((m) => (
              <div
                key={m.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <h3 className="font-medium text-gray-900">{m.title}</h3>
                  {m.description && (
                    <p className="mt-0.5 text-sm text-gray-500">{m.description}</p>
                  )}
                </div>
                {m.lessons.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">
                    No lessons in this module.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {m.lessons.map((l) => {
                      const Icon = lessonIcon(l.contentType);
                      return (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {l.title}
                              </p>
                              <p className="text-xs capitalize text-gray-400">
                                {l.contentType}
                                {l.duration ? ` · ${l.duration} min` : ""}
                              </p>
                            </div>
                          </div>
                          {l.contentUrl && (
                            <a
                              href={l.contentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {/* Evaluations */}
      {tab === "evaluations" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Plus className="h-4 w-4 text-indigo-600" />
              Deploy an evaluation
            </h2>
            {data.evaluationTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No evaluation templates are available yet. An administrator
                needs to create one before you can deploy it.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Evaluation template
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select a template…</option>
                    {data.evaluationTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Level {t.level})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-40">
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">
                    Send after (days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={delayDays}
                    onChange={(e) =>
                      setDelayDays(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={deployEvaluation}
                  disabled={deploying}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {deploying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Deploy"
                  )}
                </button>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Deployed evaluations are sent to participants automatically when
              they complete the course (after the configured delay).
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Deployed evaluations
            </h2>
            {triggers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                No evaluations have been deployed to this course yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {triggers.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {t.templateName}
                          {t.level ? ` · Level ${t.level}` : ""}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t.delayDays === 0
                            ? "Sent immediately on completion"
                            : `Sent ${t.delayDays} day${
                                t.delayDays === 1 ? "" : "s"
                              } after completion`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
