"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Zap, Plus, Trash2, Pencil, Clock, ImageIcon } from "lucide-react";
import { NUDGE_CATEGORIES } from "@/types/nudges";
import type { NudgeAction, NudgeCampaign, NudgeFrequency } from "@/types/nudges";

interface Props {
  initialActions: NudgeAction[];
  initialCampaigns: NudgeCampaign[];
}

const TIMEZONES = [
  { label: "Eastern (America/New_York)", value: "America/New_York" },
  { label: "Central (America/Chicago)", value: "America/Chicago" },
  { label: "Mountain (America/Denver)", value: "America/Denver" },
  { label: "Pacific (America/Los_Angeles)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
];

const FREQUENCIES: { label: string; value: NudgeFrequency }[] = [
  { label: "Daily", value: "daily" },
  { label: "Every other day", value: "every_other_day" },
  { label: "Weekdays", value: "weekdays" },
  { label: "Custom", value: "custom" },
];

const categoryOptions = NUDGE_CATEGORIES.map((c) => ({ label: c, value: c }));

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
      {label}
    </label>
  );
}

export default function AdminNudgesClient({ initialActions, initialCampaigns }: Props) {
  const [tab, setTab] = useState("actions");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nudges</h1>
          <p className="text-sm text-gray-500">Manage the action library and build multi-day campaigns.</p>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabsList>
          <TabsTrigger value="actions">Action Library</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <ActionLibraryTab initialActions={initialActions} />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsTab initialActions={initialActions} initialCampaigns={initialCampaigns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionLibraryTab({ initialActions }: { initialActions: NudgeAction[] }) {
  const toast = useToast();
  const [actions, setActions] = useState<NudgeAction[]>(initialActions);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(NUDGE_CATEGORIES[0]);
  const [minutes, setMinutes] = useState("2");
  const [quote, setQuote] = useState("");
  const [quoteAuthor, setQuoteAuthor] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  function reset() {
    setEditId(null);
    setTitle(""); setDescription(""); setCategory(NUDGE_CATEGORIES[0]);
    setMinutes("2"); setQuote(""); setQuoteAuthor(""); setImageUrl("");
  }

  function openNew() {
    reset();
    setOpen(true);
  }

  function openEdit(a: NudgeAction) {
    setEditId(a.id);
    setTitle(a.title);
    setDescription(a.description);
    setCategory(a.category);
    setMinutes(String(a.estimated_minutes));
    setQuote(a.quote);
    setQuoteAuthor(a.quote_author);
    setImageUrl(a.image_url);
    setOpen(true);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/nudges/image-upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setImageUrl(data.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");
    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        category,
        estimated_minutes: Number(minutes) || 0,
        image_url: imageUrl || undefined,
        quote: quote || undefined,
        quote_author: quoteAuthor || undefined,
        is_active: true,
      };
      const res = await fetch(editId ? `/api/nudges/actions/${editId}` : "/api/nudges/actions", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save action");
      }
      const saved: NudgeAction = await res.json();
      setActions((prev) => (editId ? prev.map((a) => (a.id === editId ? saved : a)) : [saved, ...prev]));
      toast.success(editId ? "Action updated" : "Action created");
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save action");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(a: NudgeAction) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/nudges/actions/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setActions((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Action deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />New Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No actions in the library yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{a.title}</p>
                    <Badge variant="info">{a.category}</Badge>
                    {!a.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-gray-600">{a.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" />~{a.estimated_minutes} min</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(a)} disabled={busyId === a.id}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editId ? "Edit Action" : "New Action"} size="lg">
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Category" options={categoryOptions} value={category} onChange={setCategory} />
            <Input label="Estimated minutes" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
          <Input label="Quote (optional)" value={quote} onChange={(e) => setQuote(e.target.value)} />
          <Input label="Quote author (optional)" value={quoteAuthor} onChange={(e) => setQuoteAuthor(e.target.value)} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Image (optional)</label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="Preview" className="h-16 w-16 rounded-md object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-300">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploading} disabled={uploading}>
                {imageUrl ? "Replace" : "Upload"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} loading={submitting} disabled={submitting}>{editId ? "Save" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CampaignsTab({ initialActions, initialCampaigns }: { initialActions: NudgeAction[]; initialCampaigns: NudgeCampaign[] }) {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<NudgeCampaign[]>(initialCampaigns);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(NUDGE_CATEGORIES[0]);
  const [frequency, setFrequency] = useState<NudgeFrequency>("daily");
  const [frequencyDays, setFrequencyDays] = useState("2");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [morningEmail, setMorningEmail] = useState(true);
  const [morningSms, setMorningSms] = useState(false);
  const [eveningEmail, setEveningEmail] = useState(true);
  const [eveningSms, setEveningSms] = useState(false);
  const [morningTime, setMorningTime] = useState("08:00");
  const [eveningTime, setEveningTime] = useState("18:00");
  const [timezone, setTimezone] = useState("America/New_York");

  function reset() {
    setName(""); setCategory(NUDGE_CATEGORIES[0]); setFrequency("daily"); setFrequencyDays("2");
    setSelectedIds([]);
    setMorningEmail(true); setMorningSms(false); setEveningEmail(true); setEveningSms(false);
    setMorningTime("08:00"); setEveningTime("18:00"); setTimezone("America/New_York");
  }

  function openNew() {
    reset();
    setOpen(true);
  }

  function toggleAction(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const categoryActions = initialActions.filter((a) => a.category === category && a.is_active);

  async function submit() {
    if (!name.trim()) return toast.error("Name is required");
    if (selectedIds.length === 0) return toast.error("Select at least one action");
    setSubmitting(true);
    try {
      const res = await fetch("/api/nudges/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          frequency,
          frequency_days: frequency === "custom" ? Number(frequencyDays) || undefined : undefined,
          action_ids: selectedIds,
          send_morning_email: morningEmail,
          send_morning_sms: morningSms,
          send_evening_email: eveningEmail,
          send_evening_sms: eveningSms,
          morning_send_time: morningTime,
          evening_send_time: eveningTime,
          timezone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create campaign");
      }
      const created: NudgeCampaign = await res.json();
      setCampaigns((prev) => [created, ...prev]);
      toast.success("Campaign created");
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(c: NudgeCampaign) {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/nudges/campaigns/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Campaign deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No campaigns yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <Badge variant="info">{c.category}</Badge>
                    <Badge variant={c.status === "active" ? "success" : "outline"} className="capitalize">{c.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {c.total_nudges} nudges · {c.enrolledCount ?? 0} enrolled · {c.completedCount ?? 0} completed
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => remove(c)} disabled={busyId === c.id}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Campaign" size="lg">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Category" options={categoryOptions} value={category} onChange={(v) => { setCategory(v); setSelectedIds([]); }} />
            <Select label="Frequency" options={FREQUENCIES} value={frequency} onChange={(v) => setFrequency(v as NudgeFrequency)} />
          </div>
          {frequency === "custom" && (
            <Input label="Every N days" type="number" min={1} value={frequencyDays} onChange={(e) => setFrequencyDays(e.target.value)} />
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Actions (in order)</label>
            {categoryActions.length === 0 ? (
              <p className="text-sm text-gray-500">No active actions in this category.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3">
                {categoryActions.map((a) => {
                  const idx = selectedIds.indexOf(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={idx >= 0} onChange={() => toggleAction(a.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      {idx >= 0 && <Badge variant="default" size="sm">{idx + 1}</Badge>}
                      {a.title}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} loading={submitting} disabled={submitting}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
