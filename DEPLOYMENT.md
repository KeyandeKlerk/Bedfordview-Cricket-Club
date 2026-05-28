# Deployment Guide

This guide covers provisioning a new BCC SaaS tenant.

## Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`
- [Vercel CLI](https://vercel.com/docs/cli) — `npm install -g vercel`
- Access to a Supabase organisation

## Automated Provisioning

Run the interactive script:

```bash
bash scripts/provision-tenant.sh
```

The script guides you through creating a Supabase project, running migrations, and deploying to Vercel.

## Manual Provisioning

### 1. Create Supabase project

Go to [supabase.com](https://supabase.com) → New project. Note the project ref, URL, anon key, and service role key.

### 2. Run migrations

In the Supabase SQL Editor, run each file from `supabase/migrations/` in order (001 → 033). Copy-paste each file's contents and execute. Stop if any migration fails.

### 3. Configure club_config

```sql
UPDATE club_config SET
  club_name = 'Your Club Name',
  club_short_name = 'YCC',
  plan = 'club',   -- or 'pro'
  is_demo = false;
```

### 4. Create the first admin user

In the Supabase Dashboard → Authentication → Users → Invite user. Then grant admin role:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<auth-user-uuid>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Find the UUID: `SELECT id, email FROM auth.users;`

### 5. Deploy to Vercel

```bash
vercel deploy --prod
```

Set these environment variables when prompted:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | Your deployed app URL |
| `WEBHOOK_SECRET` | Random secret for match report webhook |
| `CRON_SECRET` | Random secret for demo reset cron (demo instances only) |

### 6. Verify deployment

1. Open the app URL — club name should appear in the header
2. Log in with the admin account
3. Navigate to `/admin/setup` — setup checklist should show 0/5 steps complete
4. Follow the checklist to finish configuration

## Demo Instance Reset

The demo instance resets nightly via a Vercel cron at 02:00 UTC (`/api/cron/reset-demo`). The cron **wipes** all data; re-seeding requires a separate step.

**Recommended setup:** Create a GitHub Actions workflow that runs after the cron fires:

```yaml
# .github/workflows/reseed-demo.yml
name: Reseed Demo
on:
  schedule:
    - cron: '15 2 * * *'  # 15 min after wipe
jobs:
  reseed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npx tsx scripts/seed-demo.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.DEMO_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.DEMO_SERVICE_ROLE_KEY }}
```

## Upgrading a tenant from Club to Pro

```sql
UPDATE club_config SET plan = 'pro', default_scoring_mode = 'professional';
```

Analytics routes and professional scoring mode activate immediately.

## Troubleshooting

**Auth cookies not working / session lost on refresh**
Check that `middleware.ts` is not overriding Supabase cookie options with `httpOnly: true`. The browser Supabase client must be able to read auth cookies.

**`/live` not showing in-progress match**
Check: (1) scorer has a row in `user_roles`; (2) `innings.status = 'in_progress'`; (3) `matches.status = 'in_progress'`. Fix with:
```sql
UPDATE matches SET status = 'in_progress'
WHERE id IN (SELECT match_id FROM innings WHERE status = 'in_progress');
```

**RLS blocking data reads**
Ensure `club_config` public read policy exists. Run: `SELECT * FROM pg_policies WHERE tablename = 'club_config';`
