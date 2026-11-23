import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** Which merged pull request this server runs; shown to admins and developers on the start screen. */
export interface BuildVersion { pr?: number; commit?: string }

const DEFAULT_REPOSITORY = "TheGoldenSchmidt/GoldenSchmidtGames";

/** Squash merges end in "(#48)", merge commits start with "Merge pull request #48". */
export function pullRequestFromSubject(subject: string): number | undefined {
  const match = /\(#(\d+)\)\s*$/.exec(subject) ?? /^Merge pull request #(\d+)\b/.exec(subject);
  return match ? Number(match[1]) : undefined;
}

/**
 * Render's Docker build has no .git, but sets RENDER_GIT_COMMIT at runtime. The commit title is
 * then read once from the public GitHub API. Locally the checkout answers directly.
 */
export async function resolveBuildVersion(env: NodeJS.ProcessEnv = process.env): Promise<BuildVersion> {
  const sha = env.RENDER_GIT_COMMIT?.trim();
  if (sha) {
    const commit = sha.slice(0, 7);
    try {
      const repository = env.RENDER_GIT_REPO_SLUG?.trim() || DEFAULT_REPOSITORY;
      const response = await fetch(`https://api.github.com/repos/${repository}/commits/${encodeURIComponent(sha)}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "GoldenSchmidtGames-Server" },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) return { commit };
      const data = await response.json() as { commit?: { message?: string } };
      return { pr: pullRequestFromSubject(data.commit?.message?.split("\n")[0] ?? ""), commit };
    } catch { return { commit }; }
  }
  try {
    const { stdout } = await promisify(execFile)("git", ["log", "-1", "--format=%h%n%s"], { timeout: 3000 });
    const [commit, subject = ""] = stdout.trim().split("\n");
    return { pr: pullRequestFromSubject(subject), commit: commit || undefined };
  } catch { return {}; }
}

let cached: Promise<BuildVersion> | undefined;
/** One lookup per process, however many servers it starts. */
export function buildVersion() { return cached ??= resolveBuildVersion(); }
