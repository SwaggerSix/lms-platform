"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Zap, Flame, Plus, Trash2, Pause, Play, Users, ClipboardList, Mail, MessageSquare, Clock } from "lucide-react";
import { NUDGE_CATEGORIES } from "@/types/nudges";
import type {
  NudgeAction,
  NudgeAssignment,
  NudgeCampaign,
  NudgeActivitySummary,
  NudgeActivityEvent,
} from "@/types/nudges";

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Props {
  teamMembers: TeamMember[];
  initialAssignments: NudgeAssignment[];
  actions: NudgeAction[];
}

const TIMEZONES = [
  { label: "Eastern (America/New_York)", value: "America/New_York" },
  { label: "Central (America/Chicago)", value: "America/Chicago" },
  { label: "Mountain (America/Denver)", value: "America/Denver" },
  { label: "Pacific (America/Los_Angeles)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
];

function ChannelSummary({ a }: { a: NudgeAssignment }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      {a.send_morning_email && (
        <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />AM {a.morning_send_time}</span>
      )}
      {a.send_morning_sms && (
        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />AM {a.morning_send_time}</span>
      )}
      {a.send_evening_email && (
        <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />PM {a.evening_send_time}</span>
      )}
      {a.send_evening_sms && (
        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />PM {a.evening_send_time}</span>
      )}
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "active") return <Badge variant="success" className="capitalize">{status}</Badge>;
  if (status === "paused") return <Badge variant="warning" className="capitalize">{status}</Badge>;
  return <Badge variant="outline" className="capitalize">{status}</Badge>;
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
      {label}
    </label>
  );
}

export default function ManagerNudgesClient({ teamMembers, initialAssignments, actions }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState("assignments");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Nudges</h1>
          <p className="text-sm text-gray-500">Assign daily MicroActions and track your team&apos;s habits.</p>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <AssignmentsTab teamMembers={teamMembers} initialAssignments={initialAssignments} actions={actions} />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsTab teamMembers={teamMembers} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const categoryOptions = NUDGE_CATEGORIES.map((c) => ({ label: c, value: c }));

function AssignmentsTab({ teamMembers, initialAssignments, actions }: Props) {
  const toast = useToast();
  const [assignments, setAssignments] = useState<NudgeAssignment[]>(initialAssignments);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [morningEmail, setMorningEmail] = useState(true);
  const [morningSms, setMorningSms] = useState(false);
  const [eveningEmail, setEveningEmail] = useState(true);
  const [eveningSms, setEveningSms] = useState(false);
  const [morningTime, setMorningTime] = useState("08:00");
  const [eveningTime, setEveningTime] = useState("18:00");
  const [timezone, setTimezone] = useState("America/New_York");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  const filteredActions = focusArea
    ? actions.filter((a) => a.category === focusArea && a.is_active)
    : [];

  function toggleAction(id: string) {
    setSelectedActionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function reset() {
    setMemberId(""); setName(""); setEmail(""); setPhone("");
    setFocusArea(""); setSelectedActionIds([]);
    setMorningEmail(true); setMorningSms(false); setEveningEmail(true); setEveningSms(false);
    setMorningTime("08:00"); setEveningTime("18:00"); setTimezone("America/New_York");
    setStartsOn(""); setEndsOn("");
  }

  function onPickMember(value: string) {
    setMemberId(value);
    if (value === "other" || !value) {
      setName(""); setEmail("");
      return;
    }
    const m = teamMembers.find((t) => t.id === value);
    if (m) {
      setName(`${m.first_name} ${m.last_name}`.trim());
      setEmail(m.email);
    }
  }

  const memberOptions = [
    ...teamMembers.map((m) => ({ label: `${m.first_name} ${m.last_name} (${m.email})`, value: m.id })),
    { label: "Other (enter manually)", value: "other" },
  ];

  async function submit() {
    if (selectedActionIds.length === 0) return toast.error("Select at least one nudge action");
    if (!name || !email) return toast.error("Assignee name and email are required");
    setSubmitting(true);
    try {
      const created: NudgeAssignment[] = [];
      for (const actionId of selectedActionIds) {
        const res = await fetch("/api/nudges/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nudge_action_id: actionId,
            assignee_id: memberId && memberId !== "other" ? memberId : undefined,
            assignee_name: name,
            assignee_email: email,
            assignee_phone: phone || undefined,
            send_morning_email: morningEmail,
            send_morning_sms: morningSms,
            send_evening_email: eveningEmail,
            send_evening_sms: eveningSms,
            morning_send_time: morningTime,
            evening_send_time: eveningTime,
            timezone,
            starts_on: startsOn || undefined,
            ends_on: endsOn || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to assign nudge");
        }
        const row: NudgeAssignment = await res.json();
        const action = actions.find((a) => a.id === actionId);
        created.push({
          ...row,
          nudge_actions: row.nudge_actions ?? (action
            ? { title: action.title, description: action.description, estimated_minutes: action.estimated_minutes, image_url: action.image_url, quote: action.quote, quote_author: action.quote_author }
            : undefined),
        });
      }
      setAssignments((prev) => [...created, ...prev]);
      toast.success(`${created.length} nudge${created.length > 1 ? "s" : ""} assigned`);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign nudge");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(a: NudgeAssignment) {
    const next = a.status === "active" ? "paused" : "active";
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/nudges/assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
      toast.success(next === "paused" ? "Nudge paused" : "Nudge resumed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(a: NudgeAssignment) {
    if (!confirm("Delete this nudge assignment?")) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/nudges/assignments/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAssignments((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Nudge deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Assign Nudge
        </Button>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            No nudges assigned yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{a.nudge_actions?.title ?? "Nudge"}</p>
                    {statusBadge(a.status)}
                  </div>
                  <p className="text-sm text-gray-600 inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{a.assignee_name}</p>
                  <ChannelSummary a={a} />
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.status !== "completed" && (
                    <Button variant="secondary" size="sm" onClick={() => toggleStatus(a)} loading={busyId === a.id} disabled={busyId === a.id}>
                      {a.status === "active" ? <><Pause className="mr-1 h-3.5 w-3.5" />Pause</> : <><Play className="mr-1 h-3.5 w-3.5" />Resume</>}
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => remove(a)} disabled={busyId === a.id}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Assign Nudge" size="lg">
        <div className="space-y-4">
          <Select label="Team member" placeholder="Select a team member" options={memberOptions} value={memberId} onChange={onPickMember} />
          {memberId === "other" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
          <Input label="Phone (optional, for SMS)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select
            label="Focus area"
            placeholder="Select a focus area"
            options={categoryOptions}
            value={focusArea}
            onChange={(v) => { setFocusArea(v); setSelectedActionIds([]); }}
          />
          {focusArea && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nudges in {focusArea} ({selectedActionIds.length} selected)
              </label>
              {filteredActions.length === 0 ? (
                <p className="text-sm text-gray-500">No active nudges in this focus area.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-3">
                  {filteredActions.map((a) => (
                    <label key={a.id} className="flex items-start gap-2 rounded-md p-2 text-sm text-gray-700 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedActionIds.includes(a.id)}
                        onChange={() => toggleAction(a.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{a.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{a.description}</p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />~{a.estimated_minutes} min</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 p-3">
            <Checkbox label="Morning email" checked={morningEmail} onChange={setMorningEmail} />
            <Checkbox label="Morning SMS" checked={morningSms} onChange={setMorningSms} />
            <Checkbox label="Evening email" checked={eveningEmail} onChange={setEveningEmail} />
            <Checkbox label="Evening SMS" checked={eveningSms} onChange={setEveningSms} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Morning send time" type="time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} />
            <Input label="Evening send time" type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} />
          </div>
          <Select label="Timezone" options={TIMEZONES} value={timezone} onChange={setTimezone} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Starts on (optional)" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            <Input label="Ends on (optional)" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} loading={submitting} disabled={submitting}>
              Assign{selectedActionIds.length > 1 ? ` (${selectedActionIds.length})` : ""}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CampaignsTab({ teamMembers }: { teamMembers: TeamMember[] }) {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<NudgeCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollFor, setEnrollFor] = useState<NudgeCampaign | null>(null);
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/nudges/campaigns");
        if (!res.ok) throw new Error("Failed to load campaigns");
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  function onPickMember(value: string) {
    setMemberId(value);
    if (value === "other" || !value) { setName(""); setEmail(""); return; }
    const m = teamMembers.find((t) => t.id === value);
    if (m) { setName(`${m.first_name} ${m.last_name}`.trim()); setEmail(m.email); }
  }

  const memberOptions = [
    ...teamMembers.map((m) => ({ label: `${m.first_name} ${m.last_name} (${m.email})`, value: m.id })),
    { label: "Other (enter manually)", value: "other" },
  ];

  async function enroll() {
    if (!enrollFor) return;
    if (!name || !email) return toast.error("Name and email are required");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/nudges/campaigns/${enrollFor.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_id: memberId && memberId !== "other" ? memberId : undefined,
          assignee_name: name,
          assignee_email: email,
          assignee_phone: phone || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to enroll");
      }
      setCampaigns((prev) => prev.map((c) => (c.id === enrollFor.id ? { ...c, enrolledCount: (c.enrolledCount ?? 0) + 1 } : c)));
      toast.success("Enrolled");
      setEnrollFor(null);
      setMemberId(""); setName(""); setEmail(""); setPhone("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Loading campaigns...</p>;

  return (
    <div className="space-y-4">
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No campaigns available yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <Badge variant="info">{c.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {c.total_nudges} nudges · {c.enrolledCount ?? 0} enrolled · {c.completedCount ?? 0} completed
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEnrollFor(c)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Enroll
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={!!enrollFor} onClose={() => setEnrollFor(null)} title={`Enroll in ${enrollFor?.name ?? ""}`} size="md">
        <div className="space-y-4">
          <Select label="Team member" placeholder="Select a team member" options={memberOptions} value={memberId} onChange={onPickMember} />
          {memberId === "other" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
          <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEnrollFor(null)}>Cancel</Button>
            <Button onClick={enroll} loading={submitting} disabled={submitting}>Enroll</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ActivityTab() {
  const toast = useToast();
  const [summaries, setSummaries] = useState<NudgeActivitySummary[]>([]);
  const [recent, setRecent] = useState<NudgeActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/nudges/activity");
        if (!res.ok) throw new Error("Failed to load activity");
        const data = await res.json();
        setSummaries(data.summaries ?? []);
        setRecent(data.recentActivity ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Loading activity...</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Team Summary</h2>
        {summaries.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-gray-500">No activity yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {summaries.map((s) => (
              <Card key={s.assignmentId}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-900">{s.assigneeName}</p>
                    <p className="text-sm text-gray-600">{s.actionTitle}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {statusBadge(s.status)}
                      <span className="inline-flex items-center gap-1 text-orange-600"><Flame className="h-3.5 w-3.5" />{s.currentStreak} day streak</span>
                      {s.todayCommitted && <Badge variant="info" size="sm">Committed today</Badge>}
                      {s.todayCompleted && <Badge variant="success" size="sm">Completed today</Badge>}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm text-gray-500">{s.totalCompleted} total completions</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recent Activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity.</p>
        ) : (
          <Card>
            <CardContent className="divide-y divide-gray-100 p-0">
              {recent.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm text-gray-900"><span className="font-medium capitalize">{e.action}</span> · {e.actionTitle}</p>
                    {e.reflection && <p className="mt-1 text-sm italic text-gray-500">&ldquo;{e.reflection}&rdquo;</p>}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{e.date}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
