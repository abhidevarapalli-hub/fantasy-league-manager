#!/usr/bin/env bash
# Creates symlinks for .env files pointing back to the main worktree.
# Run this from any worktree: bash /path/to/main-worktree/setup-env.sh

set -euo pipefail

MAIN_WORKTREE="$(git worktree list --porcelain | head -1 | sed 's/worktree //')"
CURRENT_DIR="$(pwd)"

if [ "$MAIN_WORKTREE" = "$CURRENT_DIR" ]; then
  echo "Already in the main worktree, nothing to do."
  exit 0
fi

ENV_FILES=(
  ".env"
  ".env.development"
  ".env.development.local"
  ".env.local"
  "supabase/.env"
  "CLAUDE.md"
)

for file in "${ENV_FILES[@]}"; do
  src="$MAIN_WORKTREE/$file"
  dest="$CURRENT_DIR/$file"

  if [ ! -f "$src" ]; then
    continue
  fi

  # Remove existing regular file (not symlink) to replace with symlink
  if [ -f "$dest" ] && [ ! -L "$dest" ]; then
    rm "$dest"
    echo "Replaced $file with symlink"
  elif [ -L "$dest" ]; then
    echo "Skipped  $file (already a symlink)"
    continue
  else
    echo "Created  $file symlink"
  fi

  ln -s "$src" "$dest"
done

echo "Done. Env files are symlinked to $MAIN_WORKTREE"
