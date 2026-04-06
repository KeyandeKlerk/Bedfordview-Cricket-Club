#!/usr/bin/env bash
# Run once after cloning: npm run setup-hooks
# Installs a pre-commit hook that runs type-check + unit tests before every commit.
set -e

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

cat > "$HOOK_FILE" << 'EOF'
#!/usr/bin/env bash
set -e

echo "→ Pre-commit: type-check..."
npx tsc --noEmit

echo "→ Pre-commit: unit tests..."
npm test -- --run

echo "✓ Pre-commit checks passed"
EOF

chmod +x "$HOOK_FILE"
echo "✓ Pre-commit hook installed at $HOOK_FILE"
