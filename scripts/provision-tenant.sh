#!/usr/bin/env bash
# scripts/provision-tenant.sh
# Provisions a new BCC SaaS tenant: Supabase project + migrations + Vercel deploy.
# Prerequisites: supabase CLI (logged in), vercel CLI (logged in)

set -euo pipefail

echo ""
echo "=== BCC SaaS Tenant Provisioning ==="
echo ""

# ── Prerequisites check ──────────────────────────────────────────────────────

for cmd in supabase vercel node; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' not found. Please install it before running this script."
    exit 1
  fi
done

# ── Gather inputs ────────────────────────────────────────────────────────────

read -rp "Club name (e.g. Riverside Cricket Club): " CLUB_NAME
read -rp "Club short name (e.g. RCC, max 10 chars): " CLUB_SHORT
read -rp "Admin email: " ADMIN_EMAIL
read -rp "Plan [club/pro] (default: club): " PLAN
PLAN="${PLAN:-club}"
if [[ "$PLAN" != "club" && "$PLAN" != "pro" ]]; then
  echo "Invalid plan. Must be 'club' or 'pro'."
  exit 1
fi

read -rp "Supabase organisation ID (find at supabase.com/dashboard): " ORG_ID
read -rp "Supabase DB password (create a strong password): " DB_PASSWORD
read -rsp "Admin initial password: " ADMIN_PASSWORD
echo ""

SLUG=$(echo "$CLUB_SHORT" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '-' | tr -cd 'a-z0-9-')
PROJECT_NAME="bcc-${SLUG}"

# Pro tenants default to professional scoring mode
DEFAULT_MODE="club"
if [[ "$PLAN" == "pro" ]]; then DEFAULT_MODE="professional"; fi

echo ""
echo "Creating Supabase project '${PROJECT_NAME}'..."

# ── Create Supabase project ──────────────────────────────────────────────────

PROJECT_JSON=$(supabase projects create "$PROJECT_NAME" \
  --org-id "$ORG_ID" \
  --db-password "$DB_PASSWORD" \
  --region "ap-southeast-2" \
  --output json)

PROJECT_REF=$(echo "$PROJECT_JSON" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).id)")
PROJECT_URL="https://${PROJECT_REF}.supabase.co"

echo "Project created: $PROJECT_REF"
echo "Waiting 30s for project to initialise..."
sleep 30

# ── Get service role key ─────────────────────────────────────────────────────

SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const k=JSON.parse(d);console.log(k.find(x=>x.name==='service_role').api_key)")

echo "Service role key obtained."

# ── Run migrations ───────────────────────────────────────────────────────────

echo ""
echo "Running migrations..."

MIGRATIONS_DIR="supabase/migrations"
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  Applying $(basename "$f")..."
  supabase db push --project-ref "$PROJECT_REF" < "$f" || {
    echo "Migration failed: $f"
    exit 1
  }
done

echo "All migrations applied."

# ── Insert club_config ───────────────────────────────────────────────────────

echo ""
echo "Inserting club configuration..."

supabase sql --project-ref "$PROJECT_REF" <<SQL
UPDATE club_config SET
  club_name = '${CLUB_NAME}',
  club_short_name = '${CLUB_SHORT}',
  plan = '${PLAN}',
  default_scoring_mode = '${DEFAULT_MODE}',
  is_demo = false
WHERE true;
SQL

# ── Create admin user ────────────────────────────────────────────────────────

echo "Creating admin user ${ADMIN_EMAIL}..."

USER_JSON=$(supabase auth admin create-user \
  --project-ref "$PROJECT_REF" \
  --email "$ADMIN_EMAIL" \
  --password "$ADMIN_PASSWORD" \
  --email-confirm \
  --output json)

USER_ID=$(echo "$USER_JSON" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).id)")

supabase sql --project-ref "$PROJECT_REF" <<SQL
INSERT INTO user_roles (user_id, role) VALUES ('${USER_ID}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
SQL

echo "Admin user created: $ADMIN_EMAIL"

# ── Deploy to Vercel ─────────────────────────────────────────────────────────

echo ""
echo "Deploying to Vercel..."

ANON_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const k=JSON.parse(d);console.log(k.find(x=>x.name==='anon').api_key)")

SITE_URL=$(vercel deploy --prod \
  --env NEXT_PUBLIC_SUPABASE_URL="$PROJECT_URL" \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
  --env SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  --env NEXT_PUBLIC_SITE_URL="https://$(echo "$PROJECT_NAME").vercel.app" \
  --yes)

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  Tenant provisioned successfully!"
echo "=========================================="
echo "  App URL:            $SITE_URL"
echo "  Supabase project:   $PROJECT_REF"
echo "  Supabase dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}"
echo "  Admin login:        $ADMIN_EMAIL"
echo "  Plan:               $PLAN"
echo "=========================================="
echo ""
