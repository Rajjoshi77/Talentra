/**
 * Pure utility functions with no external dependencies.
 * Kept in a separate file so they can be imported by tests
 * without pulling in Express, Prisma, or any env-dependent modules.
 */

export function extractGithubUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");
  try {
    const candidate = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(candidate);
    const isGithubHost =
      url.hostname === "github.com" || url.hostname === "www.github.com";

    if (isGithubHost) {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    return trimmed.split("/").filter(Boolean).pop() || "";
  }

  return trimmed.split("/").filter(Boolean).pop() || trimmed;
}

export const getTimeoutSignal = (ms: number) => {
  if (typeof AbortSignal !== "undefined" && (AbortSignal as any).timeout) {
    return (AbortSignal as any).timeout(ms);
  }
  return undefined;
};

export function cleanJsonResponse(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\n?/, "");
    text = text.replace(/\n?```$/, "");
  }
  return text.trim();
}

export function maskConnectionString(url: string): string {
  try {
    if (!url) return "";
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:[^:@/]+@/, ":****@");
  }
}

export function getPasswordInfo(url: string): string {
  try {
    if (!url) return "no url";
    const parsed = new URL(url);
    const pass = parsed.password;
    if (!pass) return "no password";
    return `len: ${pass.length}, start: ${pass.substring(0, 3)}, end: ${pass.substring(pass.length - 3)}`;
  } catch {
    return "parse error";
  }
}
