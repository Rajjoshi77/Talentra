import { scrapeGithub } from "./github";

async function testProxy() {
    const repos = await scrapeGithub("octocat");
    console.log("Total Repos:", repos.length);
    console.log(JSON.stringify(repos, null, 2));
}

testProxy();