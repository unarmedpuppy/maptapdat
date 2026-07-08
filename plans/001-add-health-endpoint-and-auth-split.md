# Plan 001: Add /health, fix the EOL/off-Harbor base image, and gate external access behind the standard auth split

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ceacf8a..HEAD -- server.js docker-compose.yml`
> On drift, compare the "Current state" excerpts against the live code; on a
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (auth split) + dx (health)
- **Planned at**: commit `ceacf8a`, 2026-07-07

## Why this matters

The service is **live and publicly reachable with no auth**:
`https://maptapdat.server.unarmedpuppy.com` returned HTTP 200 on 2026-07-07.
It serves read-only game scores, but those scores carry the **real full names
of ~10 family members and friends** (`data.csv` column 1) on an
unauthenticated, internet-facing, crawlable URL. The homelab convention for
personal services is a Traefik local/external split: LAN + VPN get through
unauthenticated, external requests hit the auth middleware (see
`home-server/apps/smart-home-3d/docker-compose.yml` router labels for the
exemplar pattern). Separately, the app has no `/health` endpoint, so neither
Docker healthchecks nor Uptime Kuma can watch it (CONVENTIONS.md §2 requires
`GET /health`).

Note: the server-side compose lives in the **home-server repo**
(`home-server/apps/maptapdat/docker-compose.yml`), which is where the Traefik
labels actually run. This plan changes what it can in this repo and specifies
the server-side label change precisely for the operator.

## Current state

- `server.js:1-10` — Express app, `express.static('public')`, no `/health`
  route (`grep -n "health" server.js` → no matches). All routes are read-only
  GETs under `/api/*`.
- `Dockerfile` — `FROM node:18-alpine` (Node 18 is past end-of-life, and the
  pull bypasses Harbor — CONVENTIONS.md §3 requires
  `harbor.server.unarmedpuppy.com/...` bases). It already runs as a non-root
  user and already has a `HEALTHCHECK` (probing `/api/data`); only the base
  image and the healthcheck target need to change.
- `docker-compose.yml` (this repo) — local-dev only ("For production
  deployment, see the home-server repo"); no Traefik labels here.
- `home-server/apps/maptapdat/docker-compose.yml` — production compose:
  routers `maptapdat` (web) and `maptapdat-secure` (websecure), **no auth
  middleware on either**, no `healthcheck:` block, host port `8199` also
  published.
- Exemplar auth split (same file tree,
  `home-server/apps/smart-home-3d/docker-compose.yml`): a
  `*-local` router with
  ``ClientIP(`192.168.86.0/24`) || ClientIP(`100.64.0.0/10`)`` at
  `priority=100` and no auth, plus a lower-priority external router that
  carries the auth middleware.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `npm install` (only express + csv-parser)| exit 0              |
| Run       | `PORT=3000 node server.js`               | logs `Loaded N game records` |
| Health    | `curl -s http://localhost:3000/health`   | `{"status":"healthy","service":"maptapdat",...}` |

## Scope

**In scope** (this repo):
- `server.js` — add the `/health` route only.
- `Dockerfile` — swap the base image to
  `harbor.server.unarmedpuppy.com/docker-hub/library/node:22-alpine` and point
  the existing `HEALTHCHECK` at `/health`.

**Out of scope / operator task (specify in report, do not edit)**:
- `home-server/apps/maptapdat/docker-compose.yml` — add the local/external
  auth-split labels (copy the smart-home-3d exemplar, substituting the
  `maptapdat` host and service), add a `healthcheck:` block, and drop the
  `8199:3000` host-port publish (Traefik reaches it over `my-network`; the
  host port bypasses any auth split).
- The decision to instead take the site fully private or shut it down — that
  is the maintainer's disposition call (see plans/README.md).

## Git workflow

- Branch: `advisor/001-health-and-auth-split`; commit style per history
  (`fix:` / `feat:` prefixes), e.g. `feat: add /health endpoint and container healthcheck`.
- Do NOT push or tag unless the operator instructed it — a tag push triggers
  the real build/deploy pipeline (`.gitea/workflows/build.yml`).

## Steps

### Step 1: Add the health route

In `server.js`, immediately after `app.use(express.static('public'));`
(line 10), add:

```js
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'maptapdat', records: gameData.length });
});
```

**Verify**: `node -c "require('./server.js')"` is NOT a safe check (it starts
the server); instead run `PORT=3999 node server.js &`, then
`curl -s http://localhost:3999/health` → JSON with `"status":"healthy"`,
then kill the process.

### Step 2: Update the Dockerfile base image and healthcheck target

In `Dockerfile`:

- Change `FROM node:18-alpine` to
  `FROM harbor.server.unarmedpuppy.com/docker-hub/library/node:22-alpine`
  (Node 18 is EOL; Harbor-proxied bases are the convention — the same proxy
  path is used by `landscape-planner/Dockerfile` and others).
- In the existing `HEALTHCHECK` line, change the probed path from
  `/api/data` to `/health` (keep the `node -e "require('http')..."` form and
  all timing flags as they are).

Leave the non-root user setup and everything else untouched. Note: building
locally requires access to the Harbor registry; if
`harbor.server.unarmedpuppy.com` is unreachable from your environment, verify
with the CI build instead and say so in the report.

**Verify**: `docker build -t maptapdat:health-test . && docker run -d --rm
--name maptapdat-ht -p 3997:3000 maptapdat:health-test && sleep 35 &&
docker inspect --format '{{.State.Health.Status}}' maptapdat-ht` → `healthy`.
Then `docker stop maptapdat-ht && docker rmi maptapdat:health-test`.

### Step 3: Write the operator handoff

In your completion report, include the exact label block for
`home-server/apps/maptapdat/docker-compose.yml` (local/external split copied
from the smart-home-3d exemplar with `maptapdat` substituted), the
`healthcheck:` block, and the removal of `ports: - "8199:3000"`.

**Verify**: n/a (reporting step).

## Test plan

No test framework exists and the app is ~900 lines of read-only aggregation;
the curl + docker-inspect checks above are the verification. Do not add a
test framework.

## Done criteria

- [ ] `curl -s http://localhost:<port>/health` returns `"status":"healthy"`
- [ ] Docker healthcheck reports `healthy` (Step 2 verify)
- [ ] Only `server.js` and `Dockerfile` modified (`git status`)
- [ ] Operator label block included in the completion report
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `server.js` line 10 region doesn't match the excerpt (drift).
- The app fails to start or `npm install` fails on Node 22 (dependencies are
  only `express@^4` and `csv-parser@^3`, both Node-22-safe — but if not,
  report rather than pinning back to an EOL runtime).
- You find yourself editing anything under `home-server/` — that is operator
  scope.

## Maintenance notes

- Once the auth split lands server-side, verify from off-LAN that
  `https://maptapdat.server.unarmedpuppy.com` challenges for auth while LAN
  access stays open.
- If the maintainer instead decides to retire the service (data has been
  stale since 2025-12-09), the operator checklist is: stop/remove the
  container, delete `home-server/apps/maptapdat/`, and remove
  `maptapdat.server.unarmedpuppy.com` from the cloudflare-ddns `DOMAINS`
  list. This plan then becomes moot — mark it REJECTED in the index.
