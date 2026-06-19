let envBackendUrl = "";
try {
  envBackendUrl = process.env.BACKEND_URL || "";
} catch (e) {
  // process is not defined in browser during local dev
}

export const BACKEND_URL = (envBackendUrl || "http://localhost:3001").replace(/\/$/, "");
