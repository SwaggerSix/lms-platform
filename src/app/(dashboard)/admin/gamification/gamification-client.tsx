"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Star,
  Zap,
  MessageSquare,
  Calendar,
  Flame,
  BookOpen,
  Award,
  Target,
  Crown,
  Medal,
  Edit2,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/components/ui/toast";

export interface PointRule {
  id: string;
  action: string;
  points: number;
  description: string;
  enabled: boolean;
}

export interface BadgeItem {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  criteria: string;
  awardedCount: number;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  level: number;
  totalPoints: number;
  badgesEarned: number;
}

interface GamificationClientProps {
  pointRulesData: PointRule[];
  badges: BadgeItem[];
  leaderboard: LeaderboardUser[];
}

const tabs = ["Point Rules", "Badges", "Leaderboard"] as const;

export default function GamificationClient({ pointRulesData, badges, leaderboard }: GamificationClientProps) {
  const toast = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("Point Rules");
  const [pointRules, setPointRules] = useState(pointRulesData);
  const [savingRules, setSavingRules] = useState(false);

  // Badge modal state
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgeIcon, setBadgeIcon] = useState("");
  const [badgeCriteriaType, setBadgeCriteriaType] = useState("course_completion");
  const [badgeCriteriaCount, setBadgeCriteriaCount] = useState(1);
  const [badgePoints, setBadgePoints] = useState(0);
  const [savingBadge, setSavingBadge] = useState(false);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleAction, setRuleAction] = useState("");
  const [rulePoints, setRulePoints] = useState(10);
  const [ruleDescription, setRuleDescription] = useState("");

  const toggleRule = (id: string) => {
    setPointRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const updateRulePoints = (id: string, points: number) => {
    setPointRules((prev) => prev.map((r) => (r.id === id ? { ...r, points } : r)));
  };

  const addRule = () => {
    if (!ruleAction.trim()) return;
    const newRule: PointRule = {
      id: crypto.randomUUID(),
      action: ruleAction,
      points: rulePoints,
      description: ruleDescription,
      enabled: true,
    };
    setPointRules((prev) => [...prev, newRule]);
    setShowRuleModal(false);
    setRuleAction("");
    setRulePoints(10);
    setRuleDescription("");
  };

  const deleteRule = (id: string) => {
    setPointRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "point_rules",
          value: pointRules.map((r) => ({ id: r.id, action: r.action, points: r.points, enabled: r.enabled })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save point rules");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Failed to save point rules");
    } finally {
      setSavingRules(false);
    }
  };

  const resetBadgeModal = () => {
    setShowBadgeModal(false);
    setEditingBadgeId(null);
    setBadgeName("");
    setBadgeDescription("");
    setBadgeIcon("");
    setBadgeCriteriaType("course_completion");
    setBadgeCriteriaCount(1);
    setBadgePoints(0);
  };

  const openCreateBadge = () => {
    resetBadgeModal();
    setShowBadgeModal(true);
  };

  const openEditBadge = (badge: BadgeItem) => {
    setEditingBadgeId(badge.id);
    setBadgeName(badge.name);
    setBadgeDescription(badge.description);
    setBadgeIcon(badge.emoji);
    // Parse criteria type/count from badge.criteria text if possible
    setBadgeCriteriaType("achievement");
    setBadgeCriteriaCount(1);
    setBadgePoints(0);
    setShowBadgeModal(true);
  };

  const handleSaveBadge = async () => {
    if (!badgeName.trim()) return;
    setSavingBadge(true);
    try {
      if (editingBadgeId) {
        // Update existing badge
        const res = await fetch("/api/gamification", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingBadgeId,
            name: badgeName,
            description: badgeDescription,
            category: badgeCriteriaType,
            criteria: {
              emoji: badgeIcon || "\uD83C\uDFC6",
              color: "bg-indigo-100",
              type: badgeCriteriaType,
              count: badgeCriteriaCount,
              points: badgePoints,
              display_text: `${badgeCriteriaType}: ${badgeCriteriaCount}`,
              description: badgeDescription,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Failed to update badge");
          return;
        }
      } else {
        // Create new badge
        const res = await fetch("/api/gamification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: badgeName,
            description: badgeDescription,
            icon: badgeIcon || "\uD83C\uDFC6",
            criteria_type: badgeCriteriaType,
            criteria_count: badgeCriteriaCount,
            points: badgePoints,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Failed to create badge");
          return;
        }
      }
      resetBadgeModal();
      router.refresh();
    } catch {
      toast.error("Failed to save badge");
    } finally {
      setSavingBadge(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gamification Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure points, badges, and leaderboard settings to motivate learners</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 pb-3 text-sm font-medium transition-colors",
                activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "Point Rules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRuleModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Point Rule
            </button>
          </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Points</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Description</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pointRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
                        {rule.action === "Course Completion" && <BookOpen className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Quiz Pass" && <Target className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Perfect Score" && <Star className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Discussion Post" && <MessageSquare className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Daily Login" && <Calendar className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Learning Streak (7-day)" && <Flame className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Enrollment" && <Zap className="h-4 w-4 text-indigo-600" />}
                        {rule.action === "Path Completion" && <Trophy className="h-4 w-4 text-indigo-600" />}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{rule.action}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      min={0}
                      value={rule.points}
                      onChange={(e) => updateRulePoints(rule.id, parseInt(e.target.value) || 0)}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold text-indigo-700 text-center focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{rule.description}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", rule.enabled ? "bg-indigo-600" : "bg-gray-300")}
                    >
                      <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm", rule.enabled ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => deleteRule(rule.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete rule">
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex justify-end">
            <button
              onClick={handleSaveRules}
              disabled={savingRules}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {savingRules ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Add Rule Modal */}
        {showRuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Point Rule</h3>
                <button onClick={() => setShowRuleModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action Name</label>
                  <select
                    value={ruleAction}
                    onChange={(e) => {
                      setRuleAction(e.target.value);
                      const descs: Record<string, string> = {
                        "Course Completion": "Points awarded when a learner completes a course",
                        "Quiz Pass": "Points awarded for passing a quiz",
                        "Perfect Score": "Bonus points for achieving 100% on assessments",
                        "Discussion Post": "Points for contributing to discussions",
                        "Daily Login": "Points for logging in each day",
                        "Learning Streak (7-day)": "Bonus for maintaining a 7-day learning streak",
                        "Enrollment": "Points for enrolling in a new course",
                        "Path Completion": "Points for completing a full learning path",
                        "Peer Review": "Points for reviewing another learner's work",
                        "Certificate Earned": "Points when a certificate is issued",
                        "Help Others": "Points for answering questions in discussions",
                      };
                      setRuleDescription(descs[e.target.value] || "");
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— Select an action —</option>
                    <option value="Course Completion">Course Completion</option>
                    <option value="Quiz Pass">Quiz Pass</option>
                    <option value="Perfect Score">Perfect Score</option>
                    <option value="Discussion Post">Discussion Post</option>
                    <option value="Daily Login">Daily Login</option>
                    <option value="Learning Streak (7-day)">Learning Streak (7-day)</option>
                    <option value="Enrollment">Enrollment</option>
                    <option value="Path Completion">Path Completion</option>
                    <option value="Peer Review">Peer Review</option>
                    <option value="Certificate Earned">Certificate Earned</option>
                    <option value="Help Others">Help Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points Awarded</label>
                  <input
                    type="number"
                    min={1}
                    value={rulePoints}
                    onChange={(e) => setRulePoints(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                    placeholder="Describe when these points are awarded"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowRuleModal(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={addRule} disabled={!ruleAction.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Add Rule</button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {activeTab === "Badges" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreateBadge}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Badge
            </button>
          </div>

          {/* Badge create/edit modal */}
          {showBadgeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingBadgeId ? "Edit Badge" : "Create Badge"}
                  </h2>
                  <button onClick={resetBadgeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} placeholder="Badge name..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={2} value={badgeDescription} onChange={(e) => setBadgeDescription(e.target.value)} placeholder="Badge description..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                    <input type="text" value={badgeIcon} onChange={(e) => setBadgeIcon(e.target.value)} placeholder="e.g. \uD83C\uDFC6" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Type</label>
                      <select value={badgeCriteriaType} onChange={(e) => setBadgeCriteriaType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="course_completion">Course Completion</option>
                        <option value="quiz_pass">Quiz Pass</option>
                        <option value="streak">Streak</option>
                        <option value="points_earned">Points Earned</option>
                        <option value="discussion">Discussion Posts</option>
                        <option value="achievement">Achievement</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Count</label>
                      <input type="number" min={1} value={badgeCriteriaCount} onChange={(e) => setBadgeCriteriaCount(parseInt(e.target.value) || 1)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points Reward</label>
                    <input type="number" min={0} value={badgePoints} onChange={(e) => setBadgePoints(parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={resetBadgeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBadge}
                    disabled={savingBadge || !badgeName.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {savingBadge ? "Saving..." : editingBadgeId ? "Save Changes" : "Create Badge"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((badge) => (
              <div key={badge.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-2xl", badge.color)}>
                    {badge.emoji}
                  </div>
                  <button
                    onClick={() => openEditBadge(badge)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{badge.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{badge.description}</p>
                <div className="mt-3 rounded-lg bg-gray-50 p-2.5">
                  <p className="text-xs font-medium text-gray-500">Criteria</p>
                  <p className="mt-0.5 text-xs text-gray-700">{badge.criteria}</p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                  <Award className="h-3.5 w-3.5" />
                  <span>{badge.awardedCount} awarded</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Leaderboard" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Top 10 Learners</h2>
            <p className="text-sm text-gray-500">Based on total points earned across all activities</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Level</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total Points</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaderboard.map((user) => (
                <tr key={user.rank} className={cn("transition-colors", user.rank === 1 ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-gray-50")}>
                  <td className="px-6 py-4">
                    {user.rank <= 3 ? (
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", user.rank === 1 ? "bg-amber-100 text-amber-700" : user.rank === 2 ? "bg-gray-200 text-gray-700" : "bg-orange-100 text-orange-700")}>
                        {user.rank === 1 && <Crown className="h-4 w-4" />}
                        {user.rank === 2 && <Medal className="h-4 w-4" />}
                        {user.rank === 3 && <Medal className="h-4 w-4" />}
                      </div>
                    ) : (
                      <span className="ml-2 text-sm font-medium text-gray-500">#{user.rank}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white", user.rank === 1 ? "bg-amber-500" : "bg-indigo-500")}>
                        {user.avatar}
                      </div>
                      <span className={cn("font-medium", user.rank === 1 ? "text-amber-900" : "text-gray-900")}>{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Lvl {user.level}</span>
                  </td>
                  <td className={cn("px-6 py-4 text-right text-sm font-semibold", user.rank === 1 ? "text-amber-700" : "text-gray-900")}>
                    {user.totalPoints.toLocaleString()} pts
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-sm text-gray-700">{user.badgesEarned}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
