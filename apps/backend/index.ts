import cors from "cors";
import express from "express";
import { PreInterviewBody } from "./types";
import { scrapeGithub } from "./scrapers/github";
import { prisma } from "./db";

const app = express();

app.use(express.text({ type: ["application/sdp", "text/plain"] }));
app.use(express.json());
app.use(cors());

/*
|--------------------------------------------------------------------------
| PRE INTERVIEW
|--------------------------------------------------------------------------
*/

app.post("/api/v1/pre-interview", async (req, res) => {
    try {
        console.log("BODY:", req.body);

        const { success, data } = PreInterviewBody.safeParse(req.body);

        if (!success) {
            return res.status(411).json({
                message: "Incorrect body",
            });
        }

        console.log("GitHub URL:", data.github);

        const githubUsername = data.github.split("/").pop()!;

        console.log("Username:", githubUsername);

        const GitHubData = await scrapeGithub(githubUsername);

        console.log("Repos fetched:", GitHubData.length);

        const interview = await prisma.interview.create({
            data: {
                githubMetadata: JSON.stringify(GitHubData),
                status: "Pre",
            },
        });

        console.log("Interview Created:", interview.id);

        return res.status(200).json({
            success: true,
            interviewId: interview.id,
        });
    } catch (error) {
        console.error("Pre Interview Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| REALTIME SESSION
|--------------------------------------------------------------------------
*/

app.post("/api/v1/session", async (req, res) => {
    try {
        const sessionConfig = JSON.stringify({
            type: "realtime",
            model: "gpt-realtime-2",
            audio: {
                output: {
                    voice: "marin",
                },
            },
        });

        const fd = new FormData();

        fd.set("sdp", req.body);
        fd.set("session", sessionConfig);

        const response = await fetch(
            "https://api.openai.com/v1/realtime/calls",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_KEY}`,
                    "OpenAI-Safety-Identifier": "hashed-user-id",
                },
                body: fd,
            }
        );

        const sdp = await response.text();

        console.log("OPENAI RESPONSE:");
        console.log(sdp);

        return res.send(sdp);
    } catch (error) {
        console.error("Session Error:", error);

        return res.status(500).json({
            error: "Failed to create realtime session",
        });
    }
});

app.listen(3001, () => {
    console.log("Server running on port 3001");
});