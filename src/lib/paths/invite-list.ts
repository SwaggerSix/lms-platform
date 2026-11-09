// Client-safe: imported by the Admin → Learning Paths dialog.
// Admin → Learning Paths → "Invite people": paste addresses, everyone gets the
// path and all its courses. Parsing is shared by the dialog (live count) and
// the route (which re-parses: the client is never trusted).

export const MAX_PATH_INVITES = 200;

export interface Invitee {
  email: string;
  firstName: string;
  lastName: string;
}

export interface ParsedInviteList {
  invitees: Invitee[];
  /** Pieces of text that held no email address. */
  invalid: string[];
}

const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function splitName(raw: string): { firstName: string; lastName: string } {
  const name = raw.replace(/[<>"()]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return { firstName: "", lastName: "" };
  const i = name.indexOf(" ");
  return i === -1
    ? { firstName: name, lastName: "" }
    : { firstName: name.slice(0, i), lastName: name.slice(i + 1) };
}

/**
 * Reads a pasted list. Entries are separated by new lines, commas or
 * semicolons; each is an address with an optional name around it:
 *   jane@example.com
 *   Jane Doe <jane@example.com>
 *   Jane Doe jane@example.com
 * "Jane Doe, jane@example.com" (name then address split by a comma) also
 * works: a piece with no address is taken as the name of the next address.
 * Addresses are lower-cased and de-duplicated.
 */
export function parseInviteList(text: string): ParsedInviteList {
  const pieces = text
    .split(/[\n\r,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const invitees: Invitee[] = [];
  const invalid: string[] = [];
  let pendingName: string | null = null;

  for (const piece of pieces) {
    const match = piece.match(EMAIL_RE);
    if (!match) {
      if (pendingName !== null) invalid.push(pendingName);
      pendingName = piece;
      continue;
    }
    const email = match[0].toLowerCase();
    const rest = (piece.slice(0, match.index) + " " + piece.slice((match.index ?? 0) + match[0].length)).trim();
    const nameText = rest.replace(/[<>"()]/g, "").trim() || pendingName || "";
    pendingName = null;
    if (seen.has(email)) continue;
    seen.add(email);
    invitees.push({ email, ...splitName(nameText) });
  }
  if (pendingName !== null) invalid.push(pendingName);
  return { invitees, invalid };
}
