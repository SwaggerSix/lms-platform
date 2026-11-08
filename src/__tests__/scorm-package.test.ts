import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  parseManifest,
  resolveLaunch,
  normalizeEntryPath,
  invalidStorageKeys,
  buildContentUrl,
  toPlayableScormUrl,
  storageKeyFromSegments,
  packageIdFromUrl,
  parseScormTime,
  formatScorm12Time,
  formatScorm2004Time,
  isScormComplete,
  scorePercent,
  sanitizeRuntimeState,
  shouldProxy,
  contentTypeFor,
  EMPTY_RUNTIME_STATE,
} from "@/lib/scorm/package";
import { extractAndStorePackage, ScormPackageError } from "@/lib/scorm/extract";

// Shaped like an Articulate Storyline SCORM 1.2 export.
const STORYLINE_12 = `<?xml version="1.0" encoding="utf-8" ?>
<manifest identifier="Course_ID1" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="Course_ID1_ORG">
    <organization identifier="Course_ID1_ORG">
      <title>Workplace Safety &amp; You</title>
      <item identifier="Course_ID1_ITEM" identifierref="Course_ID1_RES" isvisible="true">
        <title>Workplace Safety</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <!-- <resource identifier="old" href="old.html"/> -->
    <resource identifier="Course_ID1_RES" type="webcontent" href="index_lms.html" adlcp:scormtype="sco">
      <file href="index_lms.html" />
    </resource>
  </resources>
</manifest>`;

// Shaped like a SCORM 2004 export with a non-default org listed first,
// xml:base on resources, and item parameters.
const SCORM_2004 = `<?xml version="1.0"?>
<manifest identifier="m" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata><schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion></metadata>
  <organizations default="ORG2">
    <organization identifier="ORG1"><title>Wrong Org</title>
      <item identifier="i0" identifierref="R0"><title>x</title></item>
    </organization>
    <organization identifier='ORG2'><title><![CDATA[Leadership Basics]]></title>
      <item identifier="i1"><title>Folder</title>
        <item identifier="i2" identifierref="R1" parameters="?mode=lms"><title>Lesson</title></item>
      </item>
    </organization>
  </organizations>
  <resources xml:base="content/">
    <resource identifier="R0" type="webcontent" adlcp:scormType="sco" href="wrong.html"/>
    <resource identifier="R1" type="webcontent" adlcp:scormType="sco" href="scormdriver/indexAPI.html"/>
  </resources>
</manifest>`;

describe("parseManifest", () => {
  it("reads SCORM 1.2 version, org title and launch href", () => {
    const m = parseManifest(STORYLINE_12);
    expect(m.version).toBe("1.2");
    expect(m.title).toBe("Workplace Safety & You");
    expect(m.launchHref).toBe("index_lms.html");
  });

  it("uses the default organization, nested items, xml:base and parameters (2004)", () => {
    const m = parseManifest(SCORM_2004);
    expect(m.version).toBe("2004");
    expect(m.title).toBe("Leadership Basics");
    expect(m.launchHref).toBe("content/scormdriver/indexAPI.html?mode=lms");
  });

  it("falls back to the first SCO resource when no item references one", () => {
    const xml = `<manifest><organizations/><resources>
      <resource identifier="a" adlcp:scormtype="asset" href="asset.html"/>
      <resource identifier="b" adlcp:scormtype="sco" href="sco.html"/>
    </resources></manifest>`;
    expect(parseManifest(xml).launchHref).toBe("sco.html");
    expect(parseManifest(xml).version).toBe("unknown");
  });
});

describe("resolveLaunch", () => {
  const read = (files: Record<string, string>) => (p: string) => files[p] ?? null;

  it("resolves the manifest href relative to a nested manifest folder", () => {
    const files = { "pkg/imsmanifest.xml": STORYLINE_12, "pkg/index_lms.html": "<html/>", "pkg/story.html": "" };
    const r = resolveLaunch(Object.keys(files), read(files));
    expect(r).toMatchObject({ launchPath: "pkg/index_lms.html", launchQuery: "", version: "1.2", hasManifest: true });
  });

  it("keeps the launch query string", () => {
    const files = { "imsmanifest.xml": SCORM_2004, "content/scormdriver/indexAPI.html": "" };
    const r = resolveLaunch(Object.keys(files), read(files));
    expect(r?.launchPath).toBe("content/scormdriver/indexAPI.html");
    expect(r?.launchQuery).toBe("?mode=lms");
  });

  it("decodes percent-encoded hrefs", () => {
    const xml = STORYLINE_12.replace(/index_lms\.html/g, "my%20course.html");
    const files = { "imsmanifest.xml": xml, "my course.html": "" };
    expect(resolveLaunch(Object.keys(files), read(files))?.launchPath).toBe("my course.html");
  });

  it("falls back to common launch files without a manifest", () => {
    const files = { "a/b/page.html": "", "x/index.html": "" };
    expect(resolveLaunch(Object.keys(files), read(files))).toMatchObject({ launchPath: "x/index.html", hasManifest: false });
  });

  it("returns null when there is nothing launchable", () => {
    expect(resolveLaunch(["a.png"], () => null)).toBeNull();
  });
});

describe("path safety", () => {
  it("normalizes and rejects unsafe or junk entries", () => {
    expect(normalizeEntryPath("dir/")).toBeNull();
    expect(normalizeEntryPath("../evil.html")).toBeNull();
    expect(normalizeEntryPath("a/../../evil.html")).toBeNull();
    expect(normalizeEntryPath("/abs.html")).toBeNull();
    expect(normalizeEntryPath("C:/x.html")).toBeNull();
    expect(normalizeEntryPath("__MACOSX/._index.html")).toBeNull();
    expect(normalizeEntryPath("a/.DS_Store")).toBeNull();
    expect(normalizeEntryPath("a\\b\\c.js")).toBe("a/b/c.js");
    expect(normalizeEntryPath("./index.html")).toBe("index.html");
  });

  it("flags file names storage would reject", () => {
    expect(invalidStorageKeys(["ok/file-1_(2).js", "spaces are ok.html", "café.png", "a#b.js"])).toEqual([
      "café.png",
      "a#b.js",
    ]);
  });

  it("only maps well-formed content paths to storage keys", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(storageKeyFromSegments([id, "story_content", "a.js"])).toBe(`scorm/${id}/story_content/a.js`);
    expect(storageKeyFromSegments([id])).toBeNull();
    expect(storageKeyFromSegments(["not-a-uuid", "a.js"])).toBeNull();
    expect(storageKeyFromSegments([id, "..", "x"])).toBeNull();
    expect(storageKeyFromSegments([id, "a\\b"])).toBeNull();
  });
});

describe("URLs", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  it("builds an encoded same-origin launch URL", () => {
    expect(buildContentUrl(id, "my course/index lms.html", "?a=1")).toBe(
      `/scorm-content/${id}/my%20course/index%20lms.html?a=1`
    );
  });
  it("rewrites legacy public-bucket URLs to the content route", () => {
    const legacy = `https://abc.supabase.co/storage/v1/object/public/course-content/scorm/${id}/index.html`;
    expect(toPlayableScormUrl(legacy)).toBe(`/scorm-content/${id}/index.html`);
    expect(toPlayableScormUrl(`/scorm-content/${id}/x.html`)).toBe(`/scorm-content/${id}/x.html`);
    expect(packageIdFromUrl(legacy)).toBe(id);
  });
  it("proxies text assets and redirects media", () => {
    expect(shouldProxy("a/b.HTML")).toBe(true);
    expect(shouldProxy("a/b.css")).toBe(true);
    expect(shouldProxy("a/b.mp4")).toBe(false);
    expect(contentTypeFor("x.woff2")).toBe("font/woff2");
    expect(contentTypeFor("x.unknown")).toBe("application/octet-stream");
  });
});

describe("SCORM time", () => {
  it("parses both formats", () => {
    expect(parseScormTime("0001:02:03.50")).toBeCloseTo(3723.5);
    expect(parseScormTime("PT1H2M3.5S")).toBeCloseTo(3723.5);
    expect(parseScormTime("P1DT1S")).toBe(86401);
    expect(parseScormTime("garbage")).toBe(0);
    expect(parseScormTime("")).toBe(0);
  });
  it("formats both formats", () => {
    expect(formatScorm12Time(3723.5)).toBe("0001:02:03.50");
    expect(formatScorm2004Time(3723.5)).toBe("PT1H2M3.5S");
  });
});

describe("completion and score", () => {
  it("recognises 1.2 and 2004 completion", () => {
    const base = { lessonStatus: "incomplete", completionStatus: "incomplete", successStatus: "unknown" };
    expect(isScormComplete(base)).toBe(false);
    expect(isScormComplete({ ...base, lessonStatus: "passed" })).toBe(true);
    expect(isScormComplete({ ...base, lessonStatus: "completed" })).toBe(true);
    expect(isScormComplete({ ...base, lessonStatus: "failed" })).toBe(false);
    expect(isScormComplete({ ...base, completionStatus: "completed" })).toBe(true);
    expect(isScormComplete({ ...base, successStatus: "passed" })).toBe(true);
  });
  it("normalizes scores to a percentage", () => {
    expect(scorePercent({ scoreRaw: 8, scoreMin: 0, scoreMax: 10, scoreScaled: null })).toBe(80);
    expect(scorePercent({ scoreRaw: 85, scoreMin: null, scoreMax: null, scoreScaled: null })).toBe(85);
    expect(scorePercent({ scoreRaw: null, scoreMin: null, scoreMax: null, scoreScaled: 0.756 })).toBe(75.6);
    expect(scorePercent({ scoreRaw: 150, scoreMin: 0, scoreMax: 100, scoreScaled: null })).toBe(100);
    expect(scorePercent({ scoreRaw: null, scoreMin: null, scoreMax: null, scoreScaled: null })).toBeNull();
  });
  it("sanitizes untrusted runtime state", () => {
    expect(sanitizeRuntimeState(null)).toBeNull();
    const s = sanitizeRuntimeState({ suspendData: "x".repeat(70000), scoreRaw: "90", lessonStatus: 5 });
    expect(s?.suspendData.length).toBe(64000);
    expect(s?.scoreRaw).toBeNull();
    expect(s?.lessonStatus).toBe(EMPTY_RUNTIME_STATE.lessonStatus);
  });
});

/** Minimal stand-in for the Supabase storage client. */
function fakeService(opts: { failPath?: string; failMessage?: string } = {}) {
  const uploads: Array<{ key: string; contentType?: string; size: number }> = [];
  const service = {
    storage: {
      from: () => ({
        upload: async (key: string, bytes: Uint8Array, o: { contentType?: string }) => {
          if (opts.failPath && key.endsWith(opts.failPath)) {
            return { error: { message: opts.failMessage ?? "boom" } };
          }
          uploads.push({ key, contentType: o.contentType, size: bytes.length });
          return { error: null };
        },
      }),
    },
  };
  return { service: service as any, uploads };
}

describe("extractAndStorePackage", () => {
  const zip = (files: Record<string, string>) =>
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

  it("stores every file under a fresh package id and returns a same-origin launch URL", async () => {
    const { service, uploads } = fakeService();
    const pkg = await extractAndStorePackage(
      service,
      zip({
        "imsmanifest.xml": STORYLINE_12,
        "index_lms.html": "<html></html>",
        "story_content/frame.js": "var a=1;",
        "__MACOSX/._index_lms.html": "junk",
      })
    );
    expect(pkg.version).toBe("1.2");
    expect(pkg.title).toBe("Workplace Safety & You");
    expect(pkg.fileCount).toBe(3);
    expect(pkg.launchUrl).toBe(`/scorm-content/${pkg.packageId}/index_lms.html`);
    expect(uploads.map((u) => u.key).sort()).toEqual(
      [
        `scorm/${pkg.packageId}/imsmanifest.xml`,
        `scorm/${pkg.packageId}/index_lms.html`,
        `scorm/${pkg.packageId}/story_content/frame.js`,
      ].sort()
    );
    expect(uploads.find((u) => u.key.endsWith(".js"))?.contentType).toContain("text/javascript");
  });

  it("rejects non-zip input, packages with no launch file, and unsafe names", async () => {
    const { service } = fakeService();
    await expect(extractAndStorePackage(service, strToU8("not a zip"))).rejects.toBeInstanceOf(ScormPackageError);
    await expect(extractAndStorePackage(service, zip({ "a.png": "x" }))).rejects.toThrow(/launch file/);
    await expect(extractAndStorePackage(service, zip({ "index.html": "", "café.js": "" }))).rejects.toThrow(
      /characters/
    );
  });

  it("explains storage size-limit failures", async () => {
    const { service } = fakeService({ failPath: "big.mp4", failMessage: "The object exceeded the maximum allowed size" });
    await expect(
      extractAndStorePackage(service, zip({ "index.html": "<html/>", "big.mp4": "x" }))
    ).rejects.toThrow(/storage upload limit/);
  });
});
