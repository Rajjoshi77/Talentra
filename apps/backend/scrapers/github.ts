export async function scrapeGithub(username: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Talentra-AI-Interviewer/1.0",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const url = `https://api.github.com/users/${username}/repos?per_page=100&sort=updated&direction=desc`;

  const attempts: Array<{ label: string; options: any }> = [
    { label: "direct", options: { headers } },
  ];


  if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
    let proxyUrl: string;
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
    } else {
      proxyUrl = `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
    }
    attempts.push({ label: "proxy", options: { headers, proxy: proxyUrl } });
  }

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const response = await fetch(url, attempt.options);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("GitHub profile not found");
        }
        if (response.status === 403 || response.status === 429) {
          throw new Error("GitHub API rate limit exceeded. Please try again later.");
        }
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("GitHub returned unexpected response format");
      }

      if (data.length === 0) {
        return [];
      }

      const sorted = [...data].sort(
        (a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0)
      );

      return sorted.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || "",
        starCount: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        language: repo.language || "",
        topics: repo.topics || [],
        isForked: repo.fork || false,
        updatedAt: repo.updated_at || "",
        htmlUrl: repo.html_url || "",
      }));
    } catch (error: any) {
      console.warn(`[Scraper] ${attempt.label} attempt failed: ${error.message}`);

      // Don't retry on user-facing errors (404, rate limit)
      if (
        error.message.includes("not found") ||
        error.message.includes("rate limit") ||
        error.message.includes("GitHub API returned")
      ) {
        throw error;
      }

      lastError = error;
    }
  }

  // All attempts failed — return empty so interview can still proceed
  console.error(`[Scraper] All attempts failed for ${username}:`, lastError?.message);
  return [];
}
