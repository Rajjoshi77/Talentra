# Troubleshooting: Prisma ECONNREFUSED

## Current state
- Backend logs show `DATABASE_URL` is set to:
  - `postgresql://postgres:postgres@localhost:5433/ai_interviewer`
- Prisma requests fail with `ECONNREFUSED`, and raw TCP connection to `localhost:5433` refused.

## What to check
1. **Postgres server is running on port 5433** on your machine.
   - If using Docker: ensure container is up and port mapping includes `5433` -> container `5432` (or whatever Postgres listens on).
2. **Firewall / binding**
   - Postgres must listen on `0.0.0.0` / correct interfaces if using Docker/VM.
3. **Correct host**
   - If Postgres runs inside Docker, `localhost` from the host is fine, but from inside containers/VM it may differ.

## Commands you can run
### Check whether something listens on 5433
- PowerShell:
  - `netstat -ano | findstr :5433`

### Try connecting with psql (if installed)
- `psql -h localhost -p 5433 -U postgres -d ai_interviewer`

## Next
After fixing the Postgres connection, restart the backend and hit:
- `POST http://localhost:3001/api/v1/pre-interview`

