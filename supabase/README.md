# Supabase migrations — workflow

The Supabase CLI manages database migrations for this project. All files in
`migrations/` are named with unique 14-digit timestamps (`YYYYMMDDHHMMSS_name.sql`),
which the CLI requires.

**Project ref:** `pvutdyosuhpwnklrpczu`

## One-time setup (per machine)

The CLI is installed at `~/.local/bin/supabase`. Then:

```bash
# 1. Create a personal access token:
#    https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_xxx        # add to ~/.zshrc to persist

# 2. Link this repo to the hosted project (prompts for the DB password)
supabase link --project-ref pvutdyosuhpwnklrpczu

# 3. Baseline: every existing migration has already been applied to prod
#    by hand, so mark them all as applied WITHOUT re-running them.
#    (Run ONCE, right after linking. Safe to re-run — it just re-asserts state.)
./supabase/baseline.sh
```

After baselining, `supabase migration list` should show every migration with a
check in both the Local and Remote columns.

## Day-to-day

```bash
# Create a new migration (auto-names it with a fresh timestamp)
supabase migration new my_change
#   -> edit supabase/migrations/<timestamp>_my_change.sql

# See what's applied vs pending
supabase migration list

# Apply all pending migrations to the linked (prod) database
supabase db push

# Preview the SQL that WOULD run, without applying it
supabase db push --dry-run
```

## Notes

- **Never** re-run the historical migrations — several are one-time data
  operations (e.g. `20260629000000_fix_placement_and_timed_events.sql`
  re-encodes raw scores). Baselining protects against this; do not manually
  delete rows from `supabase_migrations.schema_migrations`.
- The linked project ref is stored in `supabase/.temp/` (gitignored). Each
  machine must run `supabase link` once.
- `SUPABASE_ACCESS_TOKEN` and the DB password are secrets — keep them out of
  the repo.
