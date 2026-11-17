/** Keys travel only over https. Plain http is allowed for servers on this machine. */
export function isAllowedEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol === "https:") return url.hostname !== "";
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}
