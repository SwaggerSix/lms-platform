"use client";

import { useState, useEffect } from "react";
import MentorCard from "@/components/mentorship/mentor-card";
import MatchResults from "@/components/mentorship/match-results";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Button } from "@/components/ui/button";
import { getHelp } from "@/lib/help-content";

interface MentorshipClientProps {
  userId: string;
  userName: string;
  mentors: any[];
  myRequests: any[];
  myProfile: any | null;
}

export default function MentorshipClient({
  userId,
  userName,
  mentors,
  myRequests,
  myProfile,
}: MentorshipClientProps) {
  const [activeTab, setActiveTab] = useState<"browse" | "matches" | "requests" | "profile">("browse");
  const [isRequesting, setIsRequesting] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestGoals, setRequestGoals] = useState("");
  const [requestAreas, setRequestAreas] = useState("");
  const [requestType, setRequestType] = useState<"traditional" | "reverse" | "peer">("traditional");
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Profile form state
  const [profileExpertise, setProfileExpertise] = useState(
    myProfile?.expertise_areas?.join(", ") ?? ""
  );
  const [profileBio, setProfileBio] = useState(myProfile?.bio ?? "");
  const [profileYears, setProfileYears] = useState(myProfile?.years_experience ?? 0);
  const [profileAvailability, setProfileAvailability] = useState(
    myProfile?.availability ?? "available"
  );
  const [profileMaxMentees, setProfileMaxMentees] = useState(myProfile?.max_mentees ?? 3);
  const [profileTimezone, setProfileTimezone] = useState(myProfile?.timezone ?? "");
  const [profileFrequency, setProfileFrequency] = useState(
    myProfile?.preferred_meeting_frequency ?? "weekly"
  );
  // Optional discoverability preferences (opt-in)
  const [profileAffinity, setProfileAffinity] = useState(
    myProfile?.affinity_groups?.join(", ") ?? ""
  );
  const [profileLanguages, setProfileLanguages] = useState(
    myProfile?.languages?.join(", ") ?? ""
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Mentor onboarding gate (env-driven; null until fetched)
  const [onboarding, setOnboarding] = useState<{ required: boolean; completed: boolean; courseId: string | null; courseTitle: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mentorship/onboarding-status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data) setOnboarding(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Browse-Mentors search & filter state
  const [displayMentors, setDisplayMentors] = useState<any[]>(mentors);
  const [searchInput, setSearchInput] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [expertiseFilter, setExpertiseFilter] = useState("");
  const [browsing, setBrowsing] = useState(false);

  // Unique expertise values from the directory, for the filter dropdown.
  const expertiseOptions = Array.from(
    new Set(
      (mentors as any[])
        .flatMap((m) => (Array.isArray(m.expertise_areas) ? m.expertise_areas : []))
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    )
  ).sort();

  // Debounced refetch when the user changes search/filters; the API already
  // supports search/availability/expertise params.
  useEffect(() => {
    if (activeTab !== "browse") return;
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (searchInput.trim()) params.set("search", searchInput.trim());
      if (availabilityFilter) params.set("availability", availabilityFilter);
      if (expertiseFilter) params.set("expertise", expertiseFilter);
      setBrowsing(true);
      try {
        const res = await fetch(`/api/mentorship/profiles?${params.toString()}`);
        const data = await res.json();
        if (res.ok) setDisplayMentors(data.mentors ?? []);
      } catch {
        // keep prior list on transient errors
      } finally {
        setBrowsing(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput, availabilityFilter, expertiseFilter, activeTab]);

  async function handleRequestMentor(mentorUserId: string) {
    setSelectedMentorId(mentorUserId);
    setShowRequestForm(true);
    setActiveTab("browse");
  }

  async function submitRequest() {
    if (!requestGoals.trim()) {
      setRequestError("Please describe your mentorship goals");
      return;
    }

    setIsRequesting(true);
    setRequestError(null);

    try {
      const res = await fetch("/api/mentorship/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_id: selectedMentorId || undefined,
          goals: requestGoals,
          preferred_areas: requestAreas
            .split(",")
            .map((a: string) => a.trim())
            .filter(Boolean),
          mentorship_type: requestType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit request");
      }

      setRequestSuccess(true);
      setShowRequestForm(false);
      setRequestGoals("");
      setRequestAreas("");
      setSelectedMentorId(null);
    } catch (err: any) {
      setRequestError(err.message);
    } finally {
      setIsRequesting(false);
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    try {
      const res = await fetch("/api/mentorship/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertise_areas: profileExpertise
            .split(",")
            .map((a: string) => a.trim())
            .filter(Boolean),
          bio: profileBio,
          years_experience: profileYears,
          availability: profileAvailability,
          max_mentees: profileMaxMentees,
          timezone: profileTimezone,
          preferred_meeting_frequency: profileFrequency,
          affinity_groups: profileAffinity
            .split(",")
            .map((a: string) => a.trim())
            .filter(Boolean),
          languages: profileLanguages
            .split(",")
            .map((a: string) => a.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  const tabs = [
    { key: "browse", label: "Browse Mentors" },
    { key: "matches", label: "AI Matches" },
    { key: "requests", label: `My Mentorships (${myRequests.length})` },
    { key: "profile", label: "Mentor Profile" },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    matched: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Mentorship</h1>
          <InfoTooltip content={getHelp("learn.mentorship").details} label="About Mentorship" side="bottom" />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Connect with experienced mentors or become one yourself
        </p>
      </div>

      {/* Success banner */}
      {requestSuccess && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-700 font-medium">
            Mentorship request submitted successfully! You will be notified when matched.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Mentorship sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              aria-pressed={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Request form modal */}
      {showRequestForm && (
        <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Request Mentorship
            {selectedMentorId && (
              <span className="text-primary-600 font-normal"> (specific mentor selected)</span>
            )}
          </h3>
          {requestError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{requestError}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mentorship type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as "traditional" | "reverse" | "peer")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value="traditional">Traditional — learn from someone more senior</option>
                <option value="reverse">Reverse — share fresh perspective with a senior colleague</option>
                <option value="peer">Peer — partner with someone at a similar level</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What are your mentorship goals? *
              </label>
              <textarea
                value={requestGoals}
                onChange={(e) => setRequestGoals(e.target.value)}
                rows={3}
                placeholder="I want to improve my leadership skills, learn about project management..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred areas (comma-separated)
              </label>
              <input
                type="text"
                value={requestAreas}
                onChange={(e) => setRequestAreas(e.target.value)}
                placeholder="Leadership, Project Management, Python"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRequestForm(false);
                  setSelectedMentorId(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={submitRequest}
                disabled={isRequesting}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {isRequesting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browse Mentors */}
      {activeTab === "browse" && (
        <div>
          {/* Become a Mentor CTA */}
          {!myProfile && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-green-900">Want to help others grow?</h3>
                <p className="text-sm text-green-700 mt-1">
                  Share your expertise by volunteering as a mentor. Set your availability and areas of expertise.
                </p>
              </div>
              <Button variant="success" className="shrink-0" onClick={() => setActiveTab("profile")}>
                Become a Mentor
              </Button>
            </div>
          )}

          {/* Search & filters */}
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or bio..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Availability</label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Any</option>
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Expertise</label>
              <select
                value={expertiseFilter}
                onChange={(e) => setExpertiseFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Any</option>
                {expertiseOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {browsing ? "Searching..." : `${displayMentors.length} mentor${displayMentors.length === 1 ? "" : "s"} found`}
              {(searchInput || availabilityFilter || expertiseFilter) && !browsing && (
                <button
                  onClick={() => { setSearchInput(""); setAvailabilityFilter(""); setExpertiseFilter(""); }}
                  className="ml-3 text-xs text-primary-600 hover:text-primary-700"
                >
                  Clear filters
                </button>
              )}
            </p>
            <button
              onClick={() => {
                setSelectedMentorId(null);
                setShowRequestForm(true);
              }}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Request Any Mentor
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayMentors.map((mentor: any) => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                onRequestMentor={handleRequestMentor}
                isRequesting={isRequesting}
              />
            ))}
          </div>
          {displayMentors.length === 0 && !browsing && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">
                {searchInput || availabilityFilter || expertiseFilter
                  ? "No mentors match those filters. Try clearing some."
                  : "No mentors available yet. Be the first to become a mentor!"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Matches */}
      {activeTab === "matches" && (
        <MatchResults
          onRequestMentor={handleRequestMentor}
          isRequesting={isRequesting}
        />
      )}

      {/* My Requests */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-500">No mentorship requests yet.</p>
              <button
                onClick={() => setActiveTab("browse")}
                className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Browse mentors to get started
              </button>
            </div>
          ) : (
            myRequests.map((req: any) => {
              const mentee = req.mentee as any;
              const mentor = req.mentor as any;
              const isMentor = req.mentor_id === userId;
              const partner = isMentor ? mentee : mentor;
              const partnerName = partner
                ? `${partner.first_name} ${partner.last_name}`
                : "Unmatched";
              const role = isMentor ? "Mentor" : "Mentee";

              return (
                <a
                  key={req.id}
                  href={`/learn/mentorship/${req.id}`}
                  className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                        {partnerName[0] ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {partnerName}
                        </p>
                        <p className="text-xs text-gray-500">
                          You are the {role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.match_score && (
                        <span className="text-xs text-gray-400">
                          {parseFloat(req.match_score).toFixed(0)}% match
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          statusColors[req.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  </div>
                  {req.goals && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                      {req.goals}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Created {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </a>
              );
            })
          )}
        </div>
      )}

      {/* Mentor Profile */}
      {activeTab === "profile" && (
        <div className="max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {myProfile ? "Edit Your Mentor Profile" : "Become a Mentor"}
            </h3>

            {profileSaved && (
              <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-sm text-green-700">Profile saved successfully!</p>
              </div>
            )}

            {onboarding?.required && !onboarding.completed && (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <h4 className="text-sm font-semibold text-amber-900">
                  Mentor onboarding required
                </h4>
                <p className="mt-1 text-sm text-amber-800">
                  Before your profile can go live for mentees to find, please complete
                  {onboarding.courseTitle ? <> the <strong>{onboarding.courseTitle}</strong> course</> : " the mentor onboarding course"}.
                  Your profile can still be saved as a draft.
                </p>
                {onboarding.courseId && (
                  <a
                    href={`/learn/courses/${onboarding.courseId}`}
                    className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    Start onboarding course
                  </a>
                )}
              </div>
            )}
            {onboarding?.required && onboarding.completed && !myProfile?.is_active && (
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800">
                  You've completed onboarding. Re-save your profile to activate it for mentees.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expertise Areas (comma-separated)
                </label>
                <input
                  type="text"
                  value={profileExpertise}
                  onChange={(e) => setProfileExpertise(e.target.value)}
                  placeholder="JavaScript, Leadership, Data Science"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  rows={4}
                  placeholder="Tell potential mentees about yourself..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    value={profileYears}
                    onChange={(e) => setProfileYears(parseInt(e.target.value) || 0)}
                    min={0}
                    max={50}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Availability
                  </label>
                  <select
                    value={profileAvailability}
                    onChange={(e) => setProfileAvailability(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="available">Available</option>
                    <option value="limited">Limited</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Mentees
                  </label>
                  <input
                    type="number"
                    value={profileMaxMentees}
                    onChange={(e) => setProfileMaxMentees(parseInt(e.target.value) || 1)}
                    min={1}
                    max={20}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    value={profileTimezone}
                    onChange={(e) => setProfileTimezone(e.target.value)}
                    placeholder="America/New_York"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meeting Frequency
                  </label>
                  <select
                    value={profileFrequency}
                    onChange={(e) => setProfileFrequency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-4">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Optional preferences <span className="font-normal text-gray-500">— help mentees self-select. Leave blank to skip.</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Languages spoken (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={profileLanguages}
                      onChange={(e) => setProfileLanguages(e.target.value)}
                      placeholder="e.g. English, Spanish"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Affinity groups (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={profileAffinity}
                      onChange={(e) => setProfileAffinity(e.target.value)}
                      placeholder="e.g. Women in Tech, BIPOC, LGBTQ+, Veterans"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Self-identified. Shown on your mentor card so mentees can find affinity matches; never used to gate access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {profileSaving
                    ? "Saving..."
                    : myProfile
                    ? "Update Profile"
                    : "Create Mentor Profile"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
