# Bedfordview Cricket Club — Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (free at supabase.com)
- A Vercel account (free at vercel.com)

---

## Step 1: Install dependencies

```bash
npm install
```

---

## Step 2: Connect Supabase

1. Go to supabase.com → New Project
2. Once created, go to **Settings → API**
3. Copy your **Project URL** and **anon public** key
4. Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

---

## Step 3: Run the database SQL

In your Supabase dashboard, go to **SQL Editor** and run:

1. First, the schema from Phase 1 (the tables you already created)
2. Then run `supabase-setup.sql` (this file) — adds RLS policies and stats views

---

## Step 4: Grant yourself admin access

After registering on the site, go to Supabase SQL Editor and run:

```sql
update players set role = 'admin' where email = 'your@email.com';
```

This gives you access to create matches, manage players, and score.

---

## Step 5: Run locally

```bash
npm run dev
```

Open http://localhost:3000

---

## Step 6: Deploy to Vercel

```bash
npx vercel
```

Then go to Vercel dashboard → your project → **Settings → Environment Variables**
and add the same variables from your `.env.local`.

---

## File Structure

```
app/
  page.tsx              ← Homepage
  fixtures/page.tsx     ← Upcoming fixtures
  results/page.tsx      ← Past results list
  results/[id]/page.tsx ← Individual scorecard (Phase 4)
  stats/page.tsx        ← Batting & bowling tables
  squad/page.tsx        ← Player profiles
  register/page.tsx     ← Join the club
  login/page.tsx        ← Sign in
  dashboard/page.tsx    ← Member portal (role-aware)
  match/[id]/
    live/page.tsx       ← Public live scoreboard (Phase 4)
    score/page.tsx      ← Scorer interface (Phase 4)

components/
  Nav.tsx               ← Responsive navigation

lib/
  supabase.ts           ← Supabase client + typed queries
```

---

## What's built (Phase 2-3)

- ✅ Homepage with fixtures/results panels
- ✅ Fixtures page
- ✅ Results list page
- ✅ Stats page (batting + bowling tables)
- ✅ Squad page
- ✅ Register / Login
- ✅ Member dashboard (role-aware: member / scorer / admin)
- ✅ Supabase connection + typed helpers
- ✅ RLS policies
- ✅ Stats SQL views

## What's next (Phase 4-5)

- [ ] `match/[id]/score` — Scoring interface wired to Supabase
- [ ] `match/[id]/live` — Real-time public scoreboard via Supabase Realtime
- [ ] `results/[id]` — Full scorecard page
- [ ] `dashboard/new-match` — Admin: create a fixture
- [ ] `dashboard/players` — Admin: manage squad + roles
- [ ] `dashboard/opposition` — Manage opposition teams
