export async function scrapeGithub(username: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Talentra-AI-Interviewer/1.0",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Add GitHub Token if available to increase rate limit from 60 to 5000/hr
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Build proxy URL for Bun's native fetch (Bun requires a 'url' string, not host/port)
  let proxyUrl: string | undefined;
  if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
    } else {
      proxyUrl = `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
    }
  }

  const url = `https://api.github.com/users/${username}/repos?per_page=100&sort=updated&direction=desc`;

  try {
    const fetchOptions: any = {
      headers,
    };

    // Bun's fetch supports proxy as a URL string
    if (proxyUrl) {
      fetchOptions.proxy = proxyUrl;
    }

    const response = await fetch(url, fetchOptions);

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

    // Sort by stars descending so we highlight the best repos
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
    console.error(
      `[Scraper Error] Failed to scrape GitHub for ${username}:`,
      error.message
    );

    // Re-throw known errors directly
    if (
      error.message.includes("not found") ||
      error.message.includes("rate limit") ||
      error.message.includes("GitHub API returned")
    ) {
      throw error;
    }

    // For genuine network/proxy failures, throw with context
    throw new Error(
      `Failed to reach GitHub API: ${error.message}. Please try again.`
    );
  }
}
