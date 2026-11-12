// Delete the capstone hand-in files of an LMS user who no longer exists
// (e.g. a deleted test learner). Storage refuses deletes from SQL, so this
// goes through the Storage API with the SUPABASE_SERVICE_ROLE_KEY secret.
//
// Safe by construction: it only touches the private certification-submissions
// bucket, only the folder named by the user id, and refuses if that user still
// exists in public.users. Run from the "Delete removed user's capstone files"
// button (.github/workflows/delete-removed-user-capstone-files.yml).
const BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USER = (process.env.USER_ID || "").trim();
const BUCKET = "certification-submissions";

if (!BASE || !KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(USER)) {
  throw new Error("USER_ID must be an LMS user id (a UUID)");
}
// A new-style secret key goes on apikey only; the legacy JWT on both.
const auth = KEY.startsWith("sb_secret_") ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };

const exists = await fetch(`${BASE}/rest/v1/users?id=eq.${USER}&select=id`, { headers: auth });
if (!exists.ok) throw new Error(`Could not check the user (${exists.status})`);
if ((await exists.json()).length) throw new Error("That user still exists. Only a removed user's files can be deleted.");

async function list(prefix) {
  const r = await fetch(`${BASE}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!r.ok) throw new Error(`List failed (${r.status})`);
  const out = [];
  for (const e of await r.json()) {
    const path = `${prefix}${e.name}`;
    if (e.id) out.push(path);
    else out.push(...(await list(`${path}/`))); // a folder
  }
  return out;
}

const files = await list(`${USER}/`);
console.log(`${files.length} file(s) under ${BUCKET}/${USER}/`);
if (files.length) {
  const r = await fetch(`${BASE}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: files }),
  });
  if (!r.ok) throw new Error(`Delete failed (${r.status})`);
  const left = await list(`${USER}/`);
  console.log(`Deleted. ${left.length} left.`);
  if (left.length) process.exit(1);
}
