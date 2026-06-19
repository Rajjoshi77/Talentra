import axios from "axios";

export async function scrapeGithub(username: string) {
  const axiosConfig: any = {};
  
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
    "User-Agent": "Talentra-AI-Interviewer",
  };

  // Add GitHub Token if available to increase rate limit
  if (process.env.GITHUB_TOKEN) {
    axiosConfig.headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const userRepoInfo = await axios.get(
      `https://api.github.com/users/${username}/repos`,
      axiosConfig
    );

    if (!userRepoInfo.data || !Array.isArray(userRepoInfo.data)) {
      return [];
    }

    return userRepoInfo.data.map((repo: any) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      starCount: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      language: repo.language || "",
    }));
  } catch (error: any) {
    console.error(`[Scraper Error] Failed to scrape GitHub for ${username}:`, error.message);
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error("GitHub profile not found");
      }
      if (error.response.status === 403) {
        throw new Error("GitHub API rate limit exceeded");
      }
    }
    // Fall back to empty array for network/proxy connection failures so the user can still proceed
    return [];
  }
}
