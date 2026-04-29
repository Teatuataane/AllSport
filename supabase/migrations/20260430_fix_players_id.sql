-- Fix players.id so family member profiles can be created
--
-- The v2 schema defined:  id uuid PRIMARY KEY REFERENCES auth.users(id)
-- This has two problems for family member rows:
--   1. No DEFAULT — inserting without an id yields a null constraint error
--   2. FK to auth.users — family members have no auth account, so any UUID
--      that isn't a real auth user fails the FK check
--
-- Fix: drop the FK constraint and add DEFAULT gen_random_uuid().
-- Account-linked players still insert with id = auth.uid() (via the app).
-- The players_insert_own RLS policy (id = auth.uid()) enforces that.

-- Drop the FK that requires id to match an auth.users row
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_id_fkey;

-- Add a default so child profile rows auto-get a UUID when no id is supplied
ALTER TABLE players ALTER COLUMN id SET DEFAULT gen_random_uuid();
