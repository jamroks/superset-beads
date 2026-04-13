#!/usr/bin/env bash
#
# setup-fork.sh
#
# One-shot bootstrap: fork superset-sh/superset on GitHub, clone it locally,
# copy fork additions in, merge package.json surgically, install, inject, verify.
#
# Run this ONCE from the superset-fork directory (where this script lives).
# After this, day-to-day use is: bun run sync-upstream [--build]
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth status)
#   - Bun >= 1.3.6
#   - git
#   - (for builds) Xcode Command Line Tools

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
UPSTREAM_REPO="superset-sh/superset"
YOUR_GITHUB_USER="${GITHUB_USER:-}"
FORK_NAME="superset-beads"
CLONE_DIR="$HOME/devlab/$FORK_NAME"
BR_INSTALL_URL="https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh"

# Resolve the directory where THIS script lives — that's where the additions are
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▶${RESET} $*"; }
success() { echo -e "${GREEN}✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $*"; }
error()   { echo -e "${RED}✗${RESET} $*"; exit 1; }
section() { echo -e "\n${BOLD}── $* ──${RESET}"; }

# ─── Preflight ────────────────────────────────────────────────────────────────
section "Preflight checks"

command -v git >/dev/null 2>&1 || error "git not found"
success "git found"

command -v bun >/dev/null 2>&1 || error "Bun not found. Install from https://bun.sh"
success "bun $(bun --version) found"

command -v gh >/dev/null 2>&1 || error "GitHub CLI not found. Install: brew install gh"
gh auth status >/dev/null 2>&1 || error "GitHub CLI not authenticated. Run: gh auth login"
success "gh CLI authenticated"

if [ -z "$YOUR_GITHUB_USER" ]; then
  YOUR_GITHUB_USER=$(gh api user --jq .login)
fi
info "GitHub user: $YOUR_GITHUB_USER"
info "Additions source: $SCRIPT_DIR"
info "Clone target: $CLONE_DIR"

# ─── Fork ────────────────────────────────────────────────────────────────────
section "Forking $UPSTREAM_REPO"

if gh repo view "$YOUR_GITHUB_USER/$FORK_NAME" >/dev/null 2>&1; then
  warn "Fork $YOUR_GITHUB_USER/$FORK_NAME already exists — skipping"
else
  gh repo fork "$UPSTREAM_REPO" --clone=false --fork-name="$FORK_NAME"
  success "Forked to $YOUR_GITHUB_USER/$FORK_NAME"
fi

# ─── Clone ───────────────────────────────────────────────────────────────────
section "Cloning fork"

if [ -d "$CLONE_DIR" ]; then
  warn "Directory $CLONE_DIR already exists — skipping clone"
else
  gh repo clone "$YOUR_GITHUB_USER/$FORK_NAME" "$CLONE_DIR"
  success "Cloned to $CLONE_DIR"
fi

cd "$CLONE_DIR"

# ─── Upstream remote ─────────────────────────────────────────────────────────
section "Upstream remote"

if git remote get-url upstream >/dev/null 2>&1; then
  warn "Upstream remote already exists"
else
  git remote add upstream "https://github.com/$UPSTREAM_REPO.git"
  success "Added upstream remote"
fi

git fetch upstream --tags --force 2>&1 | grep -v '^\s*$' || true
success "Fetched upstream"

# ─── Copy fork additions ─────────────────────────────────────────────────────
# rsync everything from the script's own directory into the clone,
# EXCLUDING package.json (merged separately) and git/meta files.
section "Copying fork additions"

rsync -a \
  --exclude='.git' \
  --exclude='package.json' \
  --exclude='README.md' \
  --exclude='node_modules' \
  --exclude='.DS_Store' \
  "$SCRIPT_DIR/" "$CLONE_DIR/"

success "Fork additions copied (packages/, apps/, patches/, scripts/, .github/)"

# ─── Create missing workspace package.json files ─────────────────────────────
# These are not in the additions zip (identified in diff report) but are
# required by Bun for workspace resolution.
section "Creating workspace package.json files"

mkdir -p packages/task-provider packages/beads-provider

if [ ! -f "packages/task-provider/package.json" ]; then
  cat > packages/task-provider/package.json << 'EOF'
{
  "name": "@superset/task-provider",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
EOF
  success "Created packages/task-provider/package.json"
else
  warn "packages/task-provider/package.json already exists — skipping"
fi

if [ ! -f "packages/beads-provider/package.json" ]; then
  cat > packages/beads-provider/package.json << 'EOF'
{
  "name": "@superset/beads-provider",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@superset/task-provider": "workspace:*",
    "@trpc/server": "*",
    "zod": "*"
  }
}
EOF
  success "Created packages/beads-provider/package.json"
else
  warn "packages/beads-provider/package.json already exists — skipping"
fi

# ─── Merge package.json ───────────────────────────────────────────────────────
# Add only what we need into upstream's package.json.
# Never overwrites upstream keys.
# devDependencies kept alphabetically sorted (sherif enforces this).
section "Merging package.json"

bun run - << 'EOF'
import { readFileSync, writeFileSync } from 'node:fs'

const pkgPath = './package.json'
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

// ── 1. Add our scripts ──────────────────────────────────────────────────────
// Uses apply-patches.ts instead of patch-package for source file injection.
pkg.scripts = pkg.scripts ?? {}

const ourScripts = {
  'patches:apply':   'bun run scripts/apply-patches.ts',
  'patches:verify':  'bun run scripts/verify-patches.ts',
  'patches:update':  'bun run scripts/update-patches.ts',
  'sync-upstream':   'bun run scripts/sync-upstream.ts',
}

for (const [key, val] of Object.entries(ourScripts)) {
  if (!pkg.scripts[key]) {
    pkg.scripts[key] = val
    console.log(`  + scripts.${key}`)
  } else {
    console.log(`  ~ scripts.${key} already set — skipping`)
  }
}

// ── 2. Append our inject step to postinstall ────────────────────────────────
// Upstream postinstall: ./scripts/postinstall.sh
// We append: && bun run scripts/apply-patches.ts
// We do NOT add patch-package — it cannot patch source files.
const existing = pkg.scripts.postinstall ?? ''
const ourHook  = 'bun run scripts/apply-patches.ts'

if (!existing.includes(ourHook)) {
  pkg.scripts.postinstall = existing
    ? `${existing} && ${ourHook}`
    : ourHook
  console.log('  + postinstall → appended apply-patches.ts')
} else {
  console.log('  ~ postinstall already includes apply-patches.ts — skipping')
}

// ── 3. devDependencies — nothing to add ────────────────────────────────────
// We no longer add patch-package (wrong tool for source files).
// Sherif requires alphabetical order — no additions = no ordering issue.
console.log('  ~ devDependencies unchanged (no additions needed)')

writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n')
console.log('  package.json merged successfully')
EOF

success "package.json merged"

# ─── Install br ──────────────────────────────────────────────────────────────
section "Installing beads_rust (br)"

if command -v br >/dev/null 2>&1; then
  success "br already installed ($(br --version))"
else
  info "Installing br..."
  curl -fsSL "$BR_INSTALL_URL" | bash
  export PATH="$HOME/.cargo/bin:$PATH"
  success "br installed"
fi

export PATH="$HOME/.cargo/bin:$PATH"

# ─── bun install (apply-patches runs via postinstall) ────────────────────────
section "Installing dependencies"

bun install
success "Dependencies installed — apply-patches.ts ran via postinstall"

# ─── Verify injections ────────────────────────────────────────────────────────
section "Verifying injections"

bun run scripts/verify-patches.ts

# ─── Type-check ──────────────────────────────────────────────────────────────
section "Type-checking"

bun run typecheck && success "TypeScript OK" || warn "TypeScript errors — check packages/beads-provider/src/ for missing types"

# ─── Commit additions to the fork ────────────────────────────────────────────
section "Committing additions to fork"

git add .
git commit -m "chore: add beads-provider fork additions" 2>/dev/null || warn "Nothing new to commit"
git push origin main
success "Pushed to origin/main"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  ✅  Fork setup complete                             ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "  Directory : $CLONE_DIR"
echo "  Fork      : https://github.com/$YOUR_GITHUB_USER/$FORK_NAME"
echo ""
echo -e "${BOLD}  Build the app:${RESET}"
echo "    cd $CLONE_DIR"
echo "    bun run build:desktop"
echo "    open dist/*.dmg"
echo ""
echo -e "${BOLD}  Future syncs:${RESET}"
echo "    bun run sync-upstream           # sync only"
echo "    bun run sync-upstream --build   # sync + build"
echo ""
echo -e "${BOLD}  CI runs automatically daily at 07:00 UTC.${RESET}"
echo "  Configure signing secrets in GitHub repo Settings → Secrets:"
echo "    APPLE_ID · APPLE_APP_SPECIFIC_PASSWORD · APPLE_TEAM_ID"
echo "    CSC_LINK · CSC_KEY_PASSWORD"
echo ""
