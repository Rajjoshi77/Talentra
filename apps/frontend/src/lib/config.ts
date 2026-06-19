export const BACKEND_URL = (
  // If you set BACKEND_URL during build/runtime, it will override this default.
  process.env.BACKEND_URL || "https://talentra-cv2n.onrender.com"
).replace(/\/$/, "");

