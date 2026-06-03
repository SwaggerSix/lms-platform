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
    const res = await fetch(`${GRAPH}${path}`, { headers: await this.headers() });
    if (!res.ok) {
      throw new Error(`Graph GET ${path} failed: ${res.status} ${res.statusText}`);
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

  /** Download a file's raw bytes by driveItem id. */
  async downloadItem(itemId: string): Promise<ArrayBuffer> {
    const driveId = await this.getDriveId();
    const res = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}/content`, {
      headers: await this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Graph download item ${itemId} failed: ${res.status} ${res.statusText}`);
    }
    return res.arrayBuffer();
  }
}
