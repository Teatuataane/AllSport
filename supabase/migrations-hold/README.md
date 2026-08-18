# migrations-hold — staged, deliberately NOT yet a migration

`supabase db push` applies every pending file in `migrations/` in one go, so a
migration that must not run until a code deploy has happened is parked here
until its moment, then moved across.

## Currently held

### `20260813000003_players_pii_lockdown.sql`

Closes public read on `players`. This is the migration that actually fixes the
PII exposure — as of 2026-08-19, 19 email addresses and 27 dates of birth are
still readable with the anon key.

It is held because the **currently deployed** bundle still reads `players`
directly for cross-player data. Applying it before the new code is live blanks
every player name on the leaderboard, the game report and the live session, and
it fails **silently**: an RLS denial is an empty result, not an error.

**Release it only after all of these are true:**

1. `20260813000002_players_public_view.sql` is applied. (Done — 2026-08-19.)
2. The code reading `players_public` is deployed and live.
3. `/leaderboard` still shows real names, confirming the view and the code work
   together.

Then:

```bash
mv supabase/migrations-hold/20260813000003_players_pii_lockdown.sql supabase/migrations/
supabase db push
```

Verify immediately afterwards, signed out, with only the anon key. Both should
return zero rows:

```bash
curl -s "$SUPABASE_URL/rest/v1/players?select=email" -H "apikey: $ANON_KEY"
```

```bash
curl -s "$SUPABASE_URL/rest/v1/players?select=date_of_birth" -H "apikey: $ANON_KEY"
```

and `/leaderboard` should still show every name.

## Two traps this folder exists to prevent

**`supabase/baseline.sh` globs `migrations/*.sql` and marks every file applied
WITHOUT running it.** It was for the one-time July 2026 CLI setup. Run it with a
genuinely pending migration in that folder and the tracking table will claim the
fix shipped while the database is untouched. Do not run it again.

**Never reuse a migration timestamp.** On 2026-08-13 two different files were
written as `20260813000000` on two branches. One ran, the other was recorded as
applied and silently skipped forever — which is how
`guard_players_privileged_columns()` and its trigger went missing from
production for six days while the branch that added them showed as merged. The
filename's timestamp is an identity, not a label.
