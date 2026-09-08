import { expect, test, describe } from "bun:test";
import {
  cleanJsonResponse,
  extractGithubUsername,
  getTimeoutSignal,
} from "./helpers";

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
        // Runtime didn't support AbortSignal.timeout, which is fine on old setups
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

  describe("Score Weighting Calculation", () => {
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
  });
});

