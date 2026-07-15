#!/usr/bin/env bash
#
# Baseline every existing migration as "already applied".
#
# All migrations in this repo were applied to production by hand (via the
# Supabase SQL Editor) before the CLI was set up. This marks them as applied
# in supabase_migrations.schema_migrations WITHOUT re-running them, so future
# `supabase db push` only runs genuinely new migrations.
#
# Run ONCE, right after `supabase link`. Safe to re-run (idempotent).
#
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

# Resolve the CLI (PATH, or the known install location)
SUPABASE_BIN="$(command -v supabase || echo "$HOME/.local/bin/supabase")"
if [ ! -x "$SUPABASE_BIN" ]; then
  echo "Error: supabase CLI not found. Expected on PATH or at ~/.local/bin/supabase" >&2
  exit 1
fi

# Collect the 14-digit version prefix of every migration, in order
versions=()
for f in supabase/migrations/*.sql; do
  base="$(basename "$f")"
  versions+=("${base%%_*}")
done

if [ "${#versions[@]}" -eq 0 ]; then
  echo "No migrations found in supabase/migrations/" >&2
  exit 1
fi

echo "Baselining ${#versions[@]} migrations as applied:"
printf '  %s\n' "${versions[@]}"
echo

"$SUPABASE_BIN" migration repair --status applied "${versions[@]}"

echo
echo "Done. Verify with:  supabase migration list"
