import axios from "axios";

export async function scrapeGithub(username: string) {
  const proxyConfigured = Boolean(
    process.env.PROXY_HOST &&
    process.env.PROXY_PORT &&
    process.env.PROXY_USERNAME &&
    process.env.PROXY_PASSWORD,
  );

  const userRepoInfo = await axios.get(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos`,
    proxyConfigured
      ? {
          proxy: {
            protocol: "http",
            host: process.env.PROXY_HOST!,
            port: Number(process.env.PROXY_PORT!),
            auth: {
              username: process.env.PROXY_USERNAME!,
              password: process.env.PROXY_PASSWORD!,
            },
          },
          timeout: 15000,
          headers: {
            "User-Agent": "talentra-cv2n-backend",
            Accept: "application/vnd.github+json",
          },
        }
      : {
          timeout: 15000,
          headers: {
            "User-Agent": "talentra-cv2n-backend",
            Accept: "application/vnd.github+json",
          },
        },
  );

  return userRepoInfo.data.map((repo: any) => ({

    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    starCount: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
  }));
}
