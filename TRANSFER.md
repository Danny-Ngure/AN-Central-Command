# Moving AN Central Command to another computer

You are moving **three things**:

1. **The code** — the project folder.
2. **The database** — all the real data (sites, Warembo roster, team, visited flags, voter register). This lives in Postgres, *not* in the folder, so it travels as a separate backup file: `alfayo_db_backup.zip`.
3. **The photos** — they live inside the folder at `apps/web/public/team-photos/`, so they travel with the code automatically.

> ⚠️ The `.env.local` files (database password, JWT secret, encryption key) live **inside** the project folder. Keep them — logins and encrypted data only work with the same keys. If you push to GitHub instead of copying the folder, copy these 3 files by hand (they are git-ignored):
> `packages/db/.env.local`, `apps/web/.env.local`, `packages/auth/.env.local`.

---

## PART 1 — On the OLD computer (gather 2 files)

**a) Database backup** — already made: `Downloads\alfayo_db_backup.zip` (≈13 MB).

To regenerate it later if needed (PowerShell):
```powershell
docker exec alfayo-postgres pg_dump -U alfayo -d alfayo_dev --no-owner > "$env:USERPROFILE\Downloads\alfayo_db_backup.sql"
```
(The repo copy already has the role-creation preamble prepended — see the top of the .sql.)

**b) Code package** — zip the folder WITHOUT `node_modules` (it is huge and must be rebuilt anyway):
```powershell
$src   = "C:\Users\User\.gemini\antigravity\scratch\AN-Central-Command-monorepo"
$stage = "$env:USERPROFILE\Downloads\AN-Central-Command-monorepo"
robocopy $src $stage /E /XD node_modules .next .turbo dist build /NFL /NDL /NJH /NJS
Compress-Archive -Path $stage -DestinationPath "$env:USERPROFILE\Downloads\AN-Central-Command-code.zip" -Force
```

Copy **both** zips (`alfayo_db_backup.zip` + `AN-Central-Command-code.zip`) to the new computer (USB / cloud drive).

---

## PART 2 — On the NEW computer (install prerequisites, once)

1. **Node.js 20 LTS** — https://nodejs.org → install.
2. **pnpm** — open PowerShell and run:
   ```powershell
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   ```
3. **Docker Desktop** — https://www.docker.com/products/docker-desktop → install, then **launch it** and wait until it says "Engine running".

---

## PART 3 — Put the code in place

1. Unzip `AN-Central-Command-code.zip` somewhere simple, e.g. `C:\AN-Central-Command-monorepo`.
2. Open PowerShell **in that folder**:
   ```powershell
   cd C:\AN-Central-Command-monorepo
   pnpm install
   ```

---

## PART 4 — Start the database and restore the data

1. Start the local services (Postgres, Redis, MailHog):
   ```powershell
   docker compose -f infra/docker-compose.yml up -d
   ```
   Wait ~15 seconds for Postgres to become healthy: `docker ps` should show `alfayo-postgres` as `healthy`.

2. **Do NOT run `pnpm db:migrate` or `pnpm db:seed`.** The backup already contains the full schema *and* all data.

3. Unzip `alfayo_db_backup.zip` → you get `alfayo_db_backup.sql`. Restore it:
   ```powershell
   docker cp "$env:USERPROFILE\Downloads\alfayo_db_backup.sql" alfayo-postgres:/tmp/backup.sql
   docker exec alfayo-postgres psql -U alfayo -d alfayo_dev -f /tmp/backup.sql
   ```
   It scrolls a lot of `CREATE TABLE` / `COPY` lines. A few harmless `NOTICE` lines are fine.

   **If you see "already exists" errors** (you ran migrate by mistake, or restored twice), reset to a clean database and redo step 4:
   ```powershell
   docker compose -f infra/docker-compose.yml down -v
   docker compose -f infra/docker-compose.yml up -d
   ```

---

## PART 5 — Run the app

```powershell
pnpm dev
```
Open **http://localhost:3000**. Log in with the same accounts/passwords you use now (they came across in the backup).

---

## Quick checklist

- [ ] Docker Desktop running
- [ ] `pnpm install` finished
- [ ] `docker compose ... up -d` → `alfayo-postgres` healthy
- [ ] Restored `alfayo_db_backup.sql` (did **not** run migrate/seed)
- [ ] `pnpm dev` → site loads on :3000, your data is there

## Notes

- Same `.env.local` files must be present (they carry the DB password, `JWT_SECRET`, and `PGCRYPTO_KEY`). Without the same `PGCRYPTO_KEY`, encrypted fields (national IDs, TOTP secrets) cannot be read.
- Port **5433** must be free on the new machine (Postgres is mapped there).
- Team photos are restored from the folder (`apps/web/public/team-photos/`) — the database stores only the link to each file.
