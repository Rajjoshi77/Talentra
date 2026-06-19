import axios from "axios";

export async function scrapeGithub(username: string) {
  const axiosConfig: any = {
    timeout: 10000,
  };

  // Set proxy ONLY if proxy settings are configured in environment variables
  if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
    axiosConfig.proxy = {
      protocol: "http",
      host: process.env.PROXY_HOST,
      port: Number(process.env.PROXY_PORT),
    };
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      axiosConfig.proxy.auth = {
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      };
    }
  } else {
    axiosConfig.proxy = false;
  }

  // Set user-agent header as required by GitHub API
  axiosConfig.headers = {
    "User-Agent": "Talentra-AI-Interviewer/1.0",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Add GitHub Token if available to increase rate limit from 60 to 5000/hr
  if (process.env.GITHUB_TOKEN) {
    axiosConfig.headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    // Fetch up to 100 repos sorted by most recently updated
    const userRepoInfo = await axios.get(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated&direction=desc`,
      axiosConfig
    );

    if (!userRepoInfo.data || !Array.isArray(userRepoInfo.data)) {
      throw new Error("GitHub returned unexpected response format");
    }

    if (userRepoInfo.data.length === 0) {
      return [];
    }

    // Sort by stars descending so we highlight the best repos
    const sorted = [...userRepoInfo.data].sort(
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
      error.message,
      error.response?.status,
      error.response?.data
    );

    if (error.response) {
      if (error.response.status === 404) {
        throw new Error("GitHub profile not found");
      }
      if (error.response.status === 403 || error.response.status === 429) {
        throw new Error("GitHub API rate limit exceeded");
      }
    }

    // For genuine network failures, throw so we surface the issue instead of silently proceeding
    throw new Error(
      `Failed to reach GitHub API: ${error.message}. Please try again.`
    );
  }
}
