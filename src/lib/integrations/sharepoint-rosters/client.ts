import { getGraphAccessToken } from "./auth";
import type { SharePointRostersConfig } from "./types";

// ─────────────────────────────────────────────────────────────────
// Microsoft Graph SharePoint client (read-only).
//
// Resolves the site + drive, navigates by folder path, and downloads
// individual roster .xlsx files. Only GETs Graph endpoints; never
// modifies SharePoint.
// ─────────────────────────────────────────────────────────────────

const GRAPH = "https://graph.microsoft.com/v1.0";

export interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { path?: string };
}

/** A Graph call that failed, with its HTTP status (404 = not there; anything else is a real problem). */
export class GraphError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GraphError";
  }
}

/** A class folder's name starts with its start date: "2026.08.04 DOE …". */
const CLASS_FOLDER = /^\d{4}\.\d{2}\.\d{2}/;

/**
 * A year folder for years before `minYear`: "2024", "FY24", "NASA 2025",
 * "2025.08 HUD …". Folders naming no year (or a recent one) are walked.
 */
export function olderThan(name: string, minYear: number): boolean {
  const years = [
    ...[...name.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1])),
    ...[...name.matchAll(/\bFY\s?(\d{2})\b/gi)].map((m) => 2000 + Number(m[1])),
  ];
  return years.length > 0 && Math.max(...years) < minYear;
}

export class SharePointClient {
  private siteId: string | null = null;
  private driveId: string | null = null;

  constructor(private readonly config: SharePointRostersConfig) {}

  private async headers(): Promise<Record<string, string>> {
    const token = await getGraphAccessToken(this.config);
    return { Authorization: `Bearer ${token}`, Accept: "application/json" };
  }

  private async get<T>(path: string): Promise<T> {
    const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
    const res = await fetch(url, { headers: await this.headers() });
    if (!res.ok) {
      throw new GraphError(`Graph GET ${path} failed: ${res.status} ${res.statusText}`, res.status);
    }
    return res.json() as Promise<T>;
  }

  /** Resolve the site id from `{host}:/sites/{name}` once and cache it. */
  async getSiteId(): Promise<string> {
    if (this.siteId) return this.siteId;
    const data = await this.get<{ id: string }>(`/sites/${this.config.site_path}`);
    this.siteId = data.id;
    return data.id;
  }

  /** Resolve the default drive id (or one named in config) once and cache it. */
  async getDriveId(): Promise<string> {
    if (this.driveId) return this.driveId;
    const siteId = await this.getSiteId();
    if (this.config.drive_name && this.config.drive_name !== "Documents") {
      const list = await this.get<{ value: Array<{ id: string; name: string }> }>(
        `/sites/${siteId}/drives`
      );
      const match = list.value.find((d) => d.name === this.config.drive_name);
      if (!match) throw new Error(`SharePoint drive not found: ${this.config.drive_name}`);
      this.driveId = match.id;
    } else {
      const data = await this.get<{ id: string }>(`/sites/${siteId}/drive`);
      this.driveId = data.id;
    }
    return this.driveId;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getSiteId();
      await this.getDriveId();
      return { success: true, message: "Successfully connected to SharePoint" };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /** List children of a folder by drive-relative path (e.g. "/_Courses/CON 270"). */
  async listChildren(relativePath: string): Promise<DriveItem[]> {
    const driveId = await this.getDriveId();
    const encoded = relativePath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const data = await this.get<{ value: DriveItem[] }>(
      `/drives/${driveId}/root:${encoded}:/children?$top=200`
    );
    return data.value;
  }

  /**
   * Every dated class folder ("YYYY.MM.DD …") under `rootPath`, at any depth.
   * Walks the folder tree once (Graph's search index misses folders), without
   * descending into class folders, and skips year folders ("2024", "FY24",
   * "NASA 2025") older than `minYear`, so only recent branches are read.
   */
  async indexClassFolders(rootPath: string, opts: { minYear: number; maxDepth?: number }): Promise<DriveItem[]> {
    const driveId = await this.getDriveId();
    const encoded = rootPath.split("/").map((seg) => encodeURIComponent(seg)).join("/");
    const root = await this.get<DriveItem>(`/drives/${driveId}/root:${encoded}`);
    const maxDepth = opts.maxDepth ?? 6;
    const found: DriveItem[] = [];
    let level: DriveItem[] = [root];
    for (let depth = 0; depth < maxDepth && level.length > 0; depth++) {
      const nextLevel: DriveItem[] = [];
      // A few folders at a time: fast enough, gentle on Graph's throttling.
      for (let i = 0; i < level.length; i += 6) {
        const batch = await Promise.all(level.slice(i, i + 6).map((f) => this.listFolders(f.id)));
        for (const children of batch) {
          for (const child of children) {
            if (CLASS_FOLDER.test(child.name)) found.push(child);
            else if (!olderThan(child.name, opts.minYear)) nextLevel.push(child);
          }
        }
      }
      level = nextLevel;
    }
    return found;
  }

  /** A folder's subfolders (every page), with their parent path. */
  private async listFolders(itemId: string): Promise<DriveItem[]> {
    return (await this.listAll(itemId)).filter((i) => i.folder);
  }

  /** The files directly in a folder (every page). */
  async listFiles(itemId: string): Promise<DriveItem[]> {
    return (await this.listAll(itemId)).filter((i) => i.file);
  }

  private async listAll(itemId: string): Promise<DriveItem[]> {
    const driveId = await this.getDriveId();
    const out: DriveItem[] = [];
    let next: string | undefined =
      `/drives/${driveId}/items/${itemId}/children?$top=200&$select=id,name,webUrl,lastModifiedDateTime,folder,file,parentReference`;
    while (next) {
      const page: { value: DriveItem[]; "@odata.nextLink"?: string } = await this.get(next);
      out.push(...page.value);
      next = page["@odata.nextLink"];
    }
    return out;
  }

  /** Download a file's raw bytes by driveItem id. */
  async downloadItem(itemId: string): Promise<ArrayBuffer> {
    const driveId = await this.getDriveId();
    const res = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}/content`, {
      headers: await this.headers(),
    });
    if (!res.ok) {
      throw new GraphError(`Graph download item ${itemId} failed: ${res.status} ${res.statusText}`, res.status);
    }
    return res.arrayBuffer();
  }
}
