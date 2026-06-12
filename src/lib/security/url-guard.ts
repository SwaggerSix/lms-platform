/**
 * Guard for server-side fetches of admin-configured URLs (HRIS, marketplace,
 * CRM integrations). Blocks obvious SSRF targets: non-HTTP protocols,
 * loopback/link-local/private hosts, and cloud metadata endpoints.
 *
 * Note: this validates the hostname literal only — it does not resolve DNS,
 * so it is defense-in-depth, not a complete SSRF boundary. Outbound network
 * policy should remain the primary control.
 */
export function assertSafeExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  const blockedHostnames = new Set([
    "localhost",
    "metadata.google.internal",
    "metadata.goog",
  ]);
  if (blockedHostnames.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error(`Blocked host: ${host}`);
  }

  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    throw new Error(`Blocked host: ${host}`);
  }

  // IPv4 literals in loopback, private, link-local (incl. 169.254.169.254
  // cloud metadata), CGNAT, or unspecified ranges.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    const blocked =
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
    if (blocked) {
      throw new Error(`Blocked IP range: ${host}`);
    }
  }

  return url;
}
