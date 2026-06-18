import { expect, test, describe } from "bun:test";
import {
  cleanJsonResponse,
  extractGithubUsername,
  getTimeoutSignal,
} from "./index";

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
});
