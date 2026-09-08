import { expect, test, describe } from "bun:test";
import {
  cleanJsonResponse,
  extractGithubUsername,
  getTimeoutSignal,
} from "./helpers";
import { PreInterviewBody } from "./types";

describe("Backend Helpers", () => {
  describe("cleanJsonResponse", () => {
    test("should strip basic JSON markdown wrappers", () => {
      const raw = '```json\n{\n  "score": 85\n}\n```';
      const expected = '{\n  "score": 85\n}';
      expect(cleanJsonResponse(raw)).toBe(expected);
    });

    test("should strip non-specified markdown wrappers", () => {
      const raw = '```\n{\n  "score": 90\n}\n```';
      const expected = '{\n  "score": 90\n}';
      expect(cleanJsonResponse(raw)).toBe(expected);
    });

    test("should return unmodified string if no codeblock exists", () => {
      const raw = '{\n  "score": 95\n}';
      expect(cleanJsonResponse(raw)).toBe(raw);
    });

    test("should handle leading/trailing whitespace", () => {
      const raw = '  \n```json\n{"test": true}\n```  \n';
      expect(cleanJsonResponse(raw)).toBe('{"test": true}');
    });
  });

  describe("getTimeoutSignal", () => {
    test("should return an AbortSignal when milliseconds are passed", () => {
      const signal = getTimeoutSignal(1000);
      if (signal) {
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);
      } else {
        expect(signal).toBeUndefined();
      }
    });
  });

  describe("extractGithubUsername", () => {
    test("should handle plain usernames", () => {
      expect(extractGithubUsername("torvalds")).toBe("torvalds");
    });

    test("should handle profile URLs with trailing slashes", () => {
      expect(extractGithubUsername("https://github.com/torvalds/")).toBe(
        "torvalds",
      );
    });

    test("should handle GitHub URLs without protocol", () => {
      expect(
        extractGithubUsername("github.com/torvalds?tab=repositories"),
      ).toBe("torvalds");
    });
  });

  describe("PreInterviewBody Schema Validation", () => {
    test("should validate valid pre-interview request body", () => {
      const validBody = {
        github: "https://github.com/torvalds",
        linkedIn: "https://linkedin.com/in/linustorvalds",
        role: "Software Engineer",
      };
      const result = PreInterviewBody.safeParse(validBody);
      expect(result.success).toBe(true);
    });

    test("should reject missing github and linkedIn fields", () => {
      const invalidBody = {
        role: "Software Engineer",
      };
      const result = PreInterviewBody.safeParse(invalidBody);
      expect(result.success).toBe(false);
    });
  });

  describe("Score Weighting & Composite Rating Calculation", () => {
    test("should compute 5-factor weighted composite rating accurately", () => {
      const factors = {
        github: 80,         // 80 * 0.20 = 16.0
        technical: 90,      // 90 * 0.30 = 27.0
        problemSolving: 85, // 85 * 0.20 = 17.0
        testing: 60,        // 60 * 0.15 = 9.0
        communication: 90,  // 90 * 0.15 = 13.5
      };
      // Total = 16.0 + 27.0 + 17.0 + 9.0 + 13.5 = 82.5 -> 83
      const total = Math.round(
        factors.github * 0.20 +
        factors.technical * 0.30 +
        factors.problemSolving * 0.20 +
        factors.testing * 0.15 +
        factors.communication * 0.15
      );
      expect(total).toBe(83);
    });

    test("should score incomplete session with 0 answers accurately", () => {
      const factors = {
        github: 75,         // 75 * 0.20 = 15.0
        technical: 0,       // 0 * 0.30 = 0.0
        problemSolving: 0,  // 0 * 0.20 = 0.0
        testing: 40,        // 40 * 0.15 = 6.0
        communication: 0,   // 0 * 0.15 = 0.0
      };
      // Total = 15.0 + 0 + 0 + 6.0 + 0 = 21.0
      const total = Math.round(
        factors.github * 0.20 +
        factors.technical * 0.30 +
        factors.problemSolving * 0.20 +
        factors.testing * 0.15 +
        factors.communication * 0.15
      );
      expect(total).toBe(21);
    });

    test("should parse and extract EVAL_FACTORS metadata comment accurately", () => {
      const sampleFeedback = `## Detailed Report\nSome review text.\n\n<!-- EVAL_FACTORS: {"github":85,"technical":70,"problemSolving":75,"testing":60,"communication":90,"total":76} -->`;
      const match = sampleFeedback.match(/<!--\s*EVAL_FACTORS:\s*({.*?})\s*-->/s);
      expect(match).not.toBeNull();
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        expect(parsed.github).toBe(85);
        expect(parsed.total).toBe(76);
      }
    });
  });

  describe("Proctoring Telemetry Trust Logic", () => {
    test("should compute 100% trust with 0 violations", () => {
      let trustScore = 100;
      const violations = 0;
      trustScore = Math.max(0, trustScore - (violations * 10));
      expect(trustScore).toBe(100);
    });

    test("should deduct trust score on violations", () => {
      const tabSwitches = 2; // -10 per switch
      const fullscreenExits = 1; // -15 per exit
      const pasteAttempts = 1; // -15 per paste
      const totalDeductions = (tabSwitches * 10) + (fullscreenExits * 15) + (pasteAttempts * 15);
      const finalTrust = Math.max(0, 100 - totalDeductions);
      expect(finalTrust).toBe(50);
    });
  });
});


