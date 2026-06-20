# TODO - AI_Interviewer

- [ ] Determine why Prisma throws ECONNREFUSED when creating `prisma.interview`.
  - [ ] Verify `process.env.DATABASE_URL` is loaded at runtime (it is currently `undefined` in current terminal).
  - [ ] Ensure backend is started with the correct env vars (DATABASE_URL).
  - [ ] Add temporary logging for `DATABASE_URL` and Prisma connection attempts.
- [ ] After env is fixed, rerun backend and validate `/api/v1/pre-interview` inserts a row.

- [ ] Interview UI: enable webcam preview + camera toggle; keep WebRTC audio-only.
  - [ ] Add `videoRef` + `cameraOn` state.
  - [ ] Change `getUserMedia` to `{ audio: true, video: true }` in real + mock.
  - [ ] Attach stream to `<video>` for preview.
  - [ ] Ensure WebRTC sends only audio track to `pc`.
  - [ ] Add floating webcam panel (top-right) in layout.
  - [ ] Add Camera toggle button to enable/disable video track only.

