# Deployment Plan — production VPS

Written after a read-only survey of the box on 2026-10-20. Nothing has been
changed on the server; every command below is either a plan or something to run
after an explicit go-ahead.

## The box

`mail.ementech.co.ke` (69.164.244.165), Ubuntu 24.04, **2 vCPU, 6 GB RAM**,
119 GB disk at 50%. Up 49 days.

It is a shared production host. **Seven other services run under PM2**, all
currently online:

| App | cwd | restarts |
|---|---|---|
| `iphone-onlineduka` | `/var/www/iphone.onlineduka.shop` | 0 |
| `baitech-backend` | `/var/www/baitech-website` | 25 |
| `platform-hub` | `/var/www/onlineduka.shop` | 0 |
| `ementech-backend-staging` | `/var/www/ementech-website/staging/current-backend` | 47 |
| `kuku-egg-tracker` | `/opt/kuku-egg-tracker/current` | 0 — **another group, not ours** |
| `dumuwaks-backend` | `/var/dumuwaks/backend` | 7 |
| `ementech-backend` | `/var/ementech-website/current-backend` | 0 |

Also on the box: 10 Docker containers (authentik, Grafana, InfluxDB, two
evolution-api stacks), nginx with 19 vhosts, postfix, dovecot, rspamd.

**Our app is not deployed here.** No `/opt/the-ambitious`, nothing on port 3005,
no nginx vhost, and no Deploy workflow has ever run in this repo's history.
Port 3005 is free; `kuku-egg-tracker` holds 3004, so there is no port clash.

### Standing constraint

Every step below is scoped to `the-ambitious`. Nothing here may use a command
whose blast radius is the whole box. That rules out `pm2 kill`, `pm2 restart all`,
`pm2 reload all`, `systemctl restart nginx` (without a targeted config test),
and `apt upgrade`. The existing `scripts/vps-fix.sh` and `scripts/recover-vps.sh`
both call `pm2 kill` and **must not be run** — see Blocker 3.

`kuku-egg-tracker` is **not** ours — it belongs to a different group and is
staying. It is listed only because it occupies port 3004 and shares the PM2
daemon, so it is a neighbour to avoid disturbing, not a candidate to retire.

## Target: ambitious.emen.africa

DNS already points at this box:

```
ambitious.emen.africa  ->  69.164.244.165   (the box's eth0 address)
```

No DNS work is needed.

**But the domain currently lands on the wrong app.** No vhost claims it, so the
request falls through to nginx's implicit default for port 80 — which is
`admin.ementech.co.ke.conf`, first alphabetically — and gets:

```
$ curl -H "Host: ambitious.emen.africa" http://127.0.0.1:80
301 -> https://admin.ementech.co.ke/
```

Until the vhost in Phase 4 exists, anyone visiting the domain lands on an
unrelated production application. Worth knowing before anyone shares the link.

There is also no certificate covering `ambitious.emen.africa`. The existing
`emen.africa` cert covers only `emen.africa` and `www.emen.africa` — a
subdomain needs its own, obtained with certbot's webroot or DNS challenge.
Certbot on this box has been renewing on the `ementech.co.ke` family, so
webroot is the pattern that works.

## Blockers, in dependency order

### 1. Every deploy secret is missing

`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID` — none are set in the repo. Only
the six `NEXT_PUBLIC_FIREBASE_*` values exist, all dated 2026-09-18.

This is the good news: **the deploy cannot currently run at all.** There is no
window in which a half-configured deploy can reach the box. Nothing gets fixed
by adding secrets until the rest is right, and nothing is at risk until then.

### 2. Pushing to `main` auto-triggers the deploy

`ci.yml` runs on `push: main`; `deploy.yml` fires on `workflow_run` when CI
completes successfully on `main`. So **`git push` deploys to production**. The
`production` environment has `protection_rules: 0` and no wait timer — no
approval gate.

The three commits on `main` right now include the server-side auth. Pushing
them as-is would run a deploy whose health check passes (the health check only
fetches `/`, which renders fine without credentials) while **every member login
returns 503**. A green deploy, a broken app.

Before pushing anything:

- [ ] Add the missing secrets (Blocker 1)
- [ ] Add `FIREBASE_*` to the deploy job's `envs` and to the ecosystem config
- [ ] Require approval on the `production` environment, or narrow the trigger to
      `workflow_dispatch` only until this is verified working end to end

The third item is the important one. Auto-deploy should be the last thing we
turn on, not the first.

### 3. Both recovery scripts would take down all seven services

`scripts/recover-vps.sh` and `scripts/vps-fix.sh` each run `pm2 kill`, which
kills the whole PM2 daemon and every app in it — all seven above. Two of them
already show 25 and 47 restarts, which suggests someone has done this and
recovered by hand.

Fix both to use `pm2 delete the-ambitious` (scoped to our app) and drop the
`pm2 kill` fallback entirely. Until that lands, treat both scripts as booby
traps.

### 4. Node 20 on the box, build needs 24

`/usr/bin/node` is v20.20.2; no nvm, no other versions installed. Next 16 and
the Firebase CLI both refuse to run on Node 20.

**Install Node 24 alongside v20, never over it.** Several other apps build and
run on the system Node; replacing it could break their deploys at a moment we
would not notice. Target `/opt/node24`, referenced by absolute path in the
ecosystem config's `interpreter` field, with no change to `/usr/bin/node` and no
`apt` operation.

### 5. The private key contains newlines

`FIREBASE_PRIVATE_KEY` holds literal `\n` sequences. `appleboy/ssh-action` is
known to mangle multi-line values passed through `envs`. If it arrives
truncated, `isAdminConfigured()` returns false and login 503s — the same failure
as a missing secret, but after a "successful" deploy.

Handle it by writing the key to a root-owned env file on the VPS over a heredoc,
rather than passing it through the runner's environment. Verify the file's
permissions before writing (`600`, owned by root) so the key never lands
world-readable.

## Phases

Each phase is independently verifiable and stops on its own failure. Nothing in
phase N+1 starts until phase N is confirmed.

### Phase 0 — Repo fixes, zero box contact

Committed to a branch, not merged. No server risk.

- [ ] Add `FIREBASE_*` to the deploy job's `envs` and ecosystem config
- [ ] Replace `pm2 kill` with scoped `pm2 delete` in both recovery scripts
- [ ] Narrow `deploy.yml` to `workflow_dispatch` (re-enable auto later)
- [ ] Add required-reviewer protection on the `production` environment
- [ ] Add a `/api/auth/session` probe to the deploy health check — checking only
      `/` cannot see a 503 login

The health-check point matters more than it looks. The current check proves the
process booted. The thing most likely to be broken is authentication, and the
current check cannot see it.

### Phase 1 — Node 24, alongside v20

- [ ] Install to `/opt/node24` from the official tarball
- [ ] `/usr/bin/node -v` still reports v20.20.2
- [ ] `kuku-egg-tracker` still online with restart count unchanged (0)

Expected effect on other services: none. No `apt`, no change to the default
`node`, no PM2 action.

### Phase 2 — First deploy to port 3005, no nginx

- [ ] `bash scripts/deploy-remote.sh <sha>` run by hand, watched
- [ ] Port 3005 listening; `curl -sf 127.0.0.1:3005/` returns 200
- [ ] **Real login against the deployed app returns 200** — not just `/`
- [ ] All seven PM2 apps still `online`, restart counts unchanged

Nothing public changes in this phase. No vhost, so no traffic is routed and no
other service can be reached or affected. If the app is wrong, it is a local
process on an unused port.

Rollback: `pm2 delete the-ambitious`. That is the whole procedure, and it cannot
touch anything else.

### Phase 3 — Secrets migration, then rules

Only after login is confirmed working.

- [ ] `node scripts/backup-snapshot.mjs` on the box
- [ ] `migrate-secrets.mjs --dry-run`, read the report, check `problems` is empty
- [ ] `migrate-secrets.mjs --write`
- [ ] Verify a migrated member can still log in (the fallback makes this safe,
      but verify it rather than assume)
- [ ] `firebase deploy --only firestore:rules`
- [ ] Confirm `secrets/` is unreadable to a client

Rules go **last**. Deploying them before the migration leaves unmigrated
members' hashes client-readable — the exact hole this work closes.

### Phase 4 — nginx vhost + certificate for ambitious.emen.africa

- [ ] Obtain a certificate for `ambitious.emen.africa` (certbot webroot; the
      existing `emen.africa` cert does **not** cover subdomains)
- [ ] Write `/etc/nginx/sites-enabled/ambitious.emen.africa.conf`, proxying to
      `127.0.0.1:3005` and setting `Host`, `X-Real-IP`, `X-Forwarded-For`, and
      `X-Forwarded-Proto` — the standard header set on this box's other vhosts
      (`baitech-root.conf`, `api.onlineduka.shop.conf`, `emen.onlineduka.shop.conf`)

  Note on the session cookie: it is set `secure: NODE_ENV === 'production'`
  (`src/lib/server/session.ts`), so it is issued over HTTPS regardless of what
  nginx forwards. `X-Forwarded-Proto` is included because Next needs it to know
  the original scheme for redirects and `request.url`. It is a correctness item,
  not a cookie blocker — `zebra.ementech.co.ke.conf` omits it and still serves
  port 3004 fine, though that app uses a localStorage session and so never
  depended on the cookie at all.
- [ ] `nginx -t` **before** any reload
- [ ] `systemctl reload nginx` — a reload does not drop other sites; a restart would
- [ ] Verify all 19 existing vhosts still answer afterwards
- [ ] Confirm `https://ambitious.emen.africa` no longer 301s to `admin.ementech.co.ke`

The last item is the one that proves this phase actually did something: the
domain previously fell through to that admin vhost, so the redirect disappearing
is the signal that our vhost is now matching.

**Ordering note:** the app must be healthy on port 3005 before the vhost is added,
or the domain briefly serves a 502. Phase 2 exists to guarantee that.

### Phase 5 — Turn auto-deploy back on

Last, and only once phases 0–4 have run cleanly at least twice.

## Rollback at every phase

| Phase | Rollback | Blast radius |
|---|---|---|
| 1 | Remove `/opt/node24` | none |
| 2 | `pm2 delete the-ambitious` | none |
| 3 | Restore from snapshot; revert rules | Firestore only |
| 4 | Remove vhost, `nginx -t && reload` | none if `nginx -t` passes |

The snapshot in phase 3 contains member phone numbers and PIN hashes. It stays
on the box or in the gitignored `/backups`. Never committed, never shared.

## Resource note

2 vCPU, 6 GB RAM, 1.3 GB swap already in use. `openclaw-gateway` is 651 MB and a
`next-server` 380 MB. Our app is capped at 512 MB restart, and available memory
is ~2.5 GB.

It fits, but a boot-time spike during deploy is the most realistic way to
disturb a neighbour. Mitigations: deploy outside business hours, and watch
`free -m` and `pm2 status` during phase 2. If memory pressure turns out to be
real, the honest options are adding swap or raising the cap — not taking memory
from another service.

## Open questions

- Does the group want `ambitious.emen.africa` to redirect to a bare
  `emen.africa`, or is the subdomain the intended permanent address?
- Who issues the certificate — certbot's renewal timer will pick it up
  automatically once it exists, but the first issuance needs a decision on
  webroot vs DNS challenge if DNS for `emen.africa` is managed off-box.