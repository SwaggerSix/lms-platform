const OFFLINE_COURSES_KEY = "lms_offline_courses";
const OFFLINE_PROGRESS_KEY = "lms_offline_progress";

export interface OfflineCourseRecord {
  courseId: string;
  slug: string;
  title: string;
  cachedAt: string;
  urls: string[];
}

export interface OfflineProgressEntry {
  courseId: string;
  lessonId: string;
  status: "completed" | "in_progress";
  timestamp: string;
}

function getOfflineCoursesMap(): Record<string, OfflineCourseRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OFFLINE_COURSES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOfflineCoursesMap(map: Record<string, OfflineCourseRecord>): void {
  localStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(map));
}

/**
 * Build the list of URLs to cache for a given course.
 */
function buildCourseUrls(courseId: string, slug: string): string[] {
  return [
    `/learn/catalog/${slug}`,
    `/learn/player/${courseId}`,
    `/api/courses/${courseId}`,
  ];
}

/**
 * Download a course for offline access by caching its pages and content.
 */
export async function downloadCourseForOffline(
  courseId: string,
  slug: string,
  title: string
): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const urls = buildCourseUrls(courseId, slug);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 30000);

    function onMessage(event: MessageEvent) {
      if (
        event.data.type === "CACHE_COURSE_COMPLETE" &&
        event.data.courseId === courseId
      ) {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        clearTimeout(timeout);

        // Save record to localStorage
        const map = getOfflineCoursesMap();
        map[courseId] = {
          courseId,
          slug,
          title,
          cachedAt: new Date().toISOString(),
          urls,
        };
        saveOfflineCoursesMap(map);
        resolve(true);
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage);

    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: "CACHE_COURSE",
        courseId,
        urls,
      });
    });
  });
}

/**
 * Remove a course from offline cache.
 */
export async function removeCourseFromOffline(courseId: string): Promise<void> {
  const map = getOfflineCoursesMap();
  const record = map[courseId];
  if (!record) return;

  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: "CLEAR_COURSE_CACHE",
      courseId,
      urls: record.urls,
    });
  }

  delete map[courseId];
  saveOfflineCoursesMap(map);
}

/**
 * Get all courses available offline.
 */
export function getOfflineCourses(): OfflineCourseRecord[] {
  const map = getOfflineCoursesMap();
  return Object.values(map).sort(
    (a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime()
  );
}

/**
 * Check if a specific course is available offline.
 */
export function isCourseAvailableOffline(courseId: string): boolean {
  const map = getOfflineCoursesMap();
  return courseId in map;
}

/**
 * Record progress made while offline (stored locally).
 */
export function recordOfflineProgress(
  courseId: string,
  lessonId: string,
  status: "completed" | "in_progress"
): void {
  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_KEY);
    const entries: OfflineProgressEntry[] = raw ? JSON.parse(raw) : [];

    // Replace existing entry for this lesson or add new one
    const existingIdx = entries.findIndex(
      (e) => e.courseId === courseId && e.lessonId === lessonId
    );
    const entry: OfflineProgressEntry = {
      courseId,
      lessonId,
      status,
      timestamp: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      entries[existingIdx] = entry;
    } else {
      entries.push(entry);
    }

    localStorage.setItem(OFFLINE_PROGRESS_KEY, JSON.stringify(entries));
  } catch {
    // localStorage might be full
  }
}

/**
 * Sync any offline progress to the server when back online.
 * Returns the number of entries synced.
 */
export async function syncProgress(): Promise<number> {
  if (!navigator.onLine) return 0;

  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_KEY);
    if (!raw) return 0;

    const entries: OfflineProgressEntry[] = JSON.parse(raw);
    if (entries.length === 0) return 0;

    const response = await fetch("/api/courses/sync-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });

    if (response.ok) {
      localStorage.removeItem(OFFLINE_PROGRESS_KEY);
      return entries.length;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Get the count of unsynced offline progress entries.
 */
export function getUnsyncedProgressCount(): number {
  try {
    const raw = localStorage.getItem(OFFLINE_PROGRESS_KEY);
    if (!raw) return 0;
    const entries: OfflineProgressEntry[] = JSON.parse(raw);
    return entries.length;
  } catch {
    return 0;
  }
}
