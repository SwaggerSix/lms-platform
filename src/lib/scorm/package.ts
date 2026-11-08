/**
 * SCORM package helpers shared by the upload/import routes, the content
 * proxy, and tests. Pure functions only — no Supabase or Next imports.
 */

export const SCORM_BUCKET = "course-content";
/** Extracted package files live under scorm/<packageId>/... */
export const SCORM_PREFIX = "scorm";
/** Zips are staged here (per uploader) before extraction. */
export const SCORM_STAGING_PREFIX = "scorm-uploads";
/** Same-origin path the app serves extracted package files from. */
export const SCORM_CONTENT_BASE = "/scorm-content";

/** Largest zip we will extract (it is held in memory during extraction). */
export const MAX_ZIP_BYTES = 400 * 1024 * 1024;
/** Zip-bomb guard: total uncompressed size of all entries. */
export const MAX_UNCOMPRESSED_BYTES = 800 * 1024 * 1024;
export const MAX_ENTRIES = 20000;

export type ScormVersion = "1.2" | "2004" | "unknown";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  xsd: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf",
  swf: "application/x-shockwave-flash",
  wasm: "application/wasm",
};

export function fileExtension(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[fileExtension(path)] ?? "application/octet-stream";
}

/**
 * Files the content route serves through the app (same origin) rather than
 * redirecting to a signed storage URL. HTML must be same-origin so the package
 * can reach the player's SCORM API on window.parent; CSS must be too, because
 * relative url(...) references inside a stylesheet resolve against the
 * stylesheet's own URL — after a redirect that is the signed URL, which would
 * drop the token and 400 every font and background image.
 */
const PROXIED_EXTENSIONS = new Set(["html", "htm", "css", "js", "mjs", "json", "xml", "txt", "vtt"]);

export function shouldProxy(path: string): boolean {
  return PROXIED_EXTENSIONS.has(fileExtension(path));
}

export function isHtml(path: string): boolean {
  const ext = fileExtension(path);
  return ext === "html" || ext === "htm";
}

/**
 * Normalize a zip entry path and reject anything that could escape the
 * package directory or that is OS junk. Returns null for entries to skip.
 */
export function normalizeEntryPath(raw: string): string | null {
  if (!raw || raw.endsWith("/")) return null; // directory entry
  const path = raw.replace(/\\/g, "/").replace(/^\.\//, "");
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return null;
  const segments = path.split("/");
  if (segments.some((s) => s === ".." || s === "" || s === ".")) return null;
  if (segments[0] === "__MACOSX" || segments.some((s) => s === ".DS_Store" || s === "Thumbs.db")) {
    return null;
  }
  return segments.join("/");
}

/**
 * Supabase Storage object keys only allow a limited ASCII character set.
 * Returns the paths that would be rejected so the upload can fail fast with
 * a useful message instead of halfway through.
 */
const STORAGE_KEY_SAFE = /^[\w/!\-.*'() &$@=;:+,?]*$/;
export function invalidStorageKeys(paths: string[]): string[] {
  return paths.filter((p) => !STORAGE_KEY_SAFE.test(p));
}

/** Read an XML attribute from a single start tag, quote-agnostic, ns-agnostic. */
function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s(?:[\\w-]+:)?${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return (m[2] ?? m[3] ?? "").trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

function firstTitle(xml: string): string | null {
  const m = xml.match(/<(?:[\w-]+:)?title\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?title>/i);
  if (!m) return null;
  // Some tools wrap the title in <langstring>/<string>; strip any inner tags.
  const text = decodeXmlEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

export interface ManifestInfo {
  version: ScormVersion;
  title: string | null;
  /** Launch href relative to the manifest's directory, including any query. */
  launchHref: string | null;
}

/**
 * Parse the bits of imsmanifest.xml we need. Regex-based (no XML parser on the
 * server) but follows the spec's resolution order: default organization →
 * its first item with an identifierref → that resource's href (+ xml:base and
 * item parameters). Falls back to the first SCO resource, then any resource.
 */
export function parseManifest(xml: string): ManifestInfo {
  // Drop comments so commented-out resources don't win.
  const doc = xml.replace(/<!--[\s\S]*?-->/g, "");

  let version: ScormVersion = "unknown";
  const schemaVersion = doc.match(/<(?:[\w-]+:)?schemaversion\b[^>]*>([\s\S]*?)<\//i)?.[1]?.trim() ?? "";
  if (/2004|CAM\s*1\.3/i.test(schemaVersion) || /adlcp_v1p3|imscp_v1p1.*adlseq|adlnav/i.test(doc)) {
    version = "2004";
  } else if (/1\.2/.test(schemaVersion) || /adlcp_rootv1p2/i.test(doc)) {
    version = "1.2";
  }

  // Organizations
  const orgsTag = doc.match(/<(?:[\w-]+:)?organizations\b[^>]*>/i)?.[0] ?? "";
  const defaultOrgId = attr(orgsTag, "default");
  const orgBlocks = [...doc.matchAll(/<(?:[\w-]+:)?organization\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?organization>/gi)];
  const org =
    orgBlocks.find((o) => defaultOrgId && attr(`<x ${o[1]}>`, "identifier") === defaultOrgId) ?? orgBlocks[0];

  const title = (org ? firstTitle(org[2]) : null) ?? firstTitle(doc);

  // Resources
  const resourcesTag = doc.match(/<(?:[\w-]+:)?resources\b[^>]*>/i)?.[0] ?? "";
  const resourcesBase = attr(resourcesTag, "base") ?? "";
  const resourceTags = [...doc.matchAll(/<(?:[\w-]+:)?resource\b[^>]*>/gi)].map((m) => m[0]);

  const hrefOf = (tag: string): string | null => {
    const href = attr(tag, "href");
    if (!href) return null;
    return decodeXmlEntities(resourcesBase + (attr(tag, "base") ?? "") + href);
  };

  let launchHref: string | null = null;

  if (org) {
    const itemTags = [...org[2].matchAll(/<(?:[\w-]+:)?item\b[^>]*>/gi)].map((m) => m[0]);
    for (const item of itemTags) {
      const ref = attr(item, "identifierref");
      if (!ref) continue;
      const res = resourceTags.find((r) => attr(r, "identifier") === ref);
      const href = res ? hrefOf(res) : null;
      if (href) {
        const params = attr(item, "parameters");
        launchHref = params ? appendParameters(href, decodeXmlEntities(params)) : href;
        break;
      }
    }
  }

  if (!launchHref) {
    const sco = resourceTags.find((r) => /^sco$/i.test(attr(r, "scormtype") ?? "") && hrefOf(r));
    launchHref = sco ? hrefOf(sco) : null;
  }
  if (!launchHref) {
    const any = resourceTags.find((r) => hrefOf(r));
    launchHref = any ? hrefOf(any) : null;
  }

  return { version, title, launchHref };
}

/** SCORM CAM: parameters starting with ? or # replace/append to the href's query. */
function appendParameters(href: string, params: string): string {
  if (!params) return href;
  if (params.startsWith("#")) return href + params;
  const p = params.replace(/^[?&]/, "");
  return href + (href.includes("?") ? "&" : "?") + p;
}

export interface LaunchInfo {
  /** Path of the launch file within the package (no query). */
  launchPath: string;
  /** Query/fragment to append when launching (may be empty). */
  launchQuery: string;
  version: ScormVersion;
  title: string | null;
  hasManifest: boolean;
}

/**
 * Work out what to launch from the package's file list (+ manifest text).
 * Returns null when nothing launchable exists.
 */
export function resolveLaunch(paths: string[], readText: (path: string) => string | null): LaunchInfo | null {
  const manifestKey = paths
    .filter((p) => p.toLowerCase().endsWith("imsmanifest.xml"))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  const base = manifestKey ? manifestKey.slice(0, manifestKey.length - "imsmanifest.xml".length) : "";
  const pathSet = new Set(paths);

  let info: ManifestInfo = { version: "unknown", title: null, launchHref: null };
  if (manifestKey) {
    const xml = readText(manifestKey);
    if (xml) info = parseManifest(xml);
  }

  if (info.launchHref) {
    const splitAt = info.launchHref.search(/[?#]/);
    const rawPath = splitAt === -1 ? info.launchHref : info.launchHref.slice(0, splitAt);
    const query = splitAt === -1 ? "" : info.launchHref.slice(splitAt);
    let decoded = rawPath;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      /* keep raw */
    }
    for (const candidate of [base + decoded, base + rawPath]) {
      const norm = candidate.replace(/\\/g, "/").replace(/\/\.\//g, "/").replace(/^\.\//, "");
      if (pathSet.has(norm)) {
        return { launchPath: norm, launchQuery: query, version: info.version, title: info.title, hasManifest: !!manifestKey };
      }
    }
  }

  const common = ["index_lms.html", "index_lms_html5.html", "story.html", "index.html", "index.htm", "launch.html"];
  for (const name of common) {
    const found = paths
      .filter((p) => p.toLowerCase().endsWith("/" + name) || p.toLowerCase() === name)
      .sort((a, b) => a.split("/").length - b.split("/").length)[0];
    if (found) {
      return { launchPath: found, launchQuery: "", version: info.version, title: info.title, hasManifest: !!manifestKey };
    }
  }

  const html = paths.filter((p) => /\.html?$/i.test(p)).sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!html) return null;
  return { launchPath: html, launchQuery: "", version: info.version, title: info.title, hasManifest: !!manifestKey };
}

/** Build the same-origin launch URL for an extracted package file. */
export function buildContentUrl(packageId: string, launchPath: string, launchQuery = ""): string {
  const encoded = launchPath.split("/").map(encodeURIComponent).join("/");
  return `${SCORM_CONTENT_BASE}/${packageId}/${encoded}${launchQuery}`;
}

/**
 * Map a stored lesson content_url to the URL the player should load. Older
 * uploads stored a Supabase public-bucket URL (which 404s because the bucket
 * is private); rewrite those to the same-origin content route.
 */
export function toPlayableScormUrl(url: string): string {
  const marker = `/storage/v1/object/public/${SCORM_BUCKET}/${SCORM_PREFIX}/`;
  const i = url.indexOf(marker);
  if (i !== -1) return `${SCORM_CONTENT_BASE}/${url.slice(i + marker.length)}`;
  return url;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate /scorm-content/<packageId>/<...path> segments and build the storage key. */
export function storageKeyFromSegments(segments: string[]): string | null {
  if (segments.length < 2) return null;
  if (!UUID_RE.test(segments[0])) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\\") || s.includes("\0"))) return null;
  return `${SCORM_PREFIX}/${segments.join("/")}`;
}

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Package id from a playable URL (/scorm-content/<id>/...), if any. */
export function packageIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = toPlayableScormUrl(url).match(/\/scorm-content\/([0-9a-f-]{36})\//i);
  return m && isUuid(m[1]) ? m[1] : null;
}

// ---------------------------------------------------------------------------
// SCORM time formats
// ---------------------------------------------------------------------------

/** Parse SCORM 1.2 (HHHH:MM:SS.SS) or 2004 (ISO 8601 duration) to seconds. */
export function parseScormTime(value: string | null | undefined): number {
  if (!value) return 0;
  const v = value.trim();
  const hms = v.match(/^(\d{1,4}):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const iso = v.match(
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (iso) {
    const [, y, mo, d, h, mi, s] = iso.map((x) => (x ? Number(x) : 0)) as number[];
    return y * 31536000 + mo * 2592000 + d * 86400 + h * 3600 + mi * 60 + s;
  }
  return 0;
}

export function formatScorm12Time(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t - h * 3600 - m * 60;
  return `${String(h).padStart(4, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

export function formatScorm2004Time(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.round((t - h * 3600 - m * 60) * 100) / 100;
  return `PT${h}H${m}M${s}S`;
}

// ---------------------------------------------------------------------------
// Runtime state persisted per learner/lesson (lesson_progress.bookmark_data.scorm)
// ---------------------------------------------------------------------------

export interface ScormRuntimeState {
  location: string;
  suspendData: string;
  /** SCORM 1.2 cmi.core.lesson_status */
  lessonStatus: string;
  /** SCORM 2004 cmi.completion_status */
  completionStatus: string;
  /** SCORM 2004 cmi.success_status */
  successStatus: string;
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  scoreScaled: number | null;
  totalTimeSeconds: number;
}

export const EMPTY_RUNTIME_STATE: ScormRuntimeState = {
  location: "",
  suspendData: "",
  lessonStatus: "not attempted",
  completionStatus: "unknown",
  successStatus: "unknown",
  scoreRaw: null,
  scoreMin: null,
  scoreMax: null,
  scoreScaled: null,
  totalTimeSeconds: 0,
};

/** Has the learner finished, under either SCORM version's rules? */
export function isScormComplete(state: Pick<ScormRuntimeState, "lessonStatus" | "completionStatus" | "successStatus">): boolean {
  return (
    state.lessonStatus === "completed" ||
    state.lessonStatus === "passed" ||
    state.completionStatus === "completed" ||
    state.successStatus === "passed"
  );
}

/** Score as a 0–100 percentage, when the package reported one. */
export function scorePercent(state: Pick<ScormRuntimeState, "scoreRaw" | "scoreMin" | "scoreMax" | "scoreScaled">): number | null {
  let pct: number | null = null;
  if (typeof state.scoreScaled === "number" && Number.isFinite(state.scoreScaled)) {
    pct = state.scoreScaled * 100;
  } else if (typeof state.scoreRaw === "number" && Number.isFinite(state.scoreRaw)) {
    const min = state.scoreMin ?? 0;
    const max = state.scoreMax ?? 100;
    pct = max > min ? ((state.scoreRaw - min) / (max - min)) * 100 : state.scoreRaw;
  }
  if (pct === null || !Number.isFinite(pct)) return null;
  return Math.round(Math.min(100, Math.max(0, pct)) * 100) / 100;
}

/** Coerce untrusted JSON into a runtime state (bounded string sizes). */
export function sanitizeRuntimeState(input: unknown): ScormRuntimeState | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    location: str(o.location, 1000),
    // SCORM 2004 allows 64k characters of suspend data.
    suspendData: str(o.suspendData, 64000),
    lessonStatus: str(o.lessonStatus, 32) || EMPTY_RUNTIME_STATE.lessonStatus,
    completionStatus: str(o.completionStatus, 32) || EMPTY_RUNTIME_STATE.completionStatus,
    successStatus: str(o.successStatus, 32) || EMPTY_RUNTIME_STATE.successStatus,
    scoreRaw: num(o.scoreRaw),
    scoreMin: num(o.scoreMin),
    scoreMax: num(o.scoreMax),
    scoreScaled: num(o.scoreScaled),
    totalTimeSeconds: Math.max(0, num(o.totalTimeSeconds) ?? 0),
  };
}
