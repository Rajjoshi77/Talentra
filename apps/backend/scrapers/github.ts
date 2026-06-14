import axios from "axios";

export async function scrapeGithub(username: string) {
  const userRepoInfo = await axios.get(
    `https://api.github.com/users/${username}/repos`,
    {
      proxy: {
        protocol: "http",
        host: process.env.PROXY_HOST!,
        port: Number(process.env.PROXY_PORT!),
        auth: {
          username: process.env.PROXY_USERNAME!,
          password: process.env.PROXY_PASSWORD!,
        },
      },
    }
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