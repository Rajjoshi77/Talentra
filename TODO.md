# TODO - AI_Interviewer

- [ ] Determine why Prisma throws ECONNREFUSED when creating `prisma.interview`.
  - [ ] Verify `process.env.DATABASE_URL` is loaded at runtime (it is currently `undefined` in current terminal).
  - [ ] Ensure backend is started with the correct env vars (DATABASE_URL).
  - [ ] Add temporary logging for `DATABASE_URL` and Prisma connection attempts.
- [ ] After env is fixed, rerun backend and validate `/api/v1/pre-interview` inserts a row.

