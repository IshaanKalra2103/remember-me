-- Disable RLS on all application tables.
-- The backend server is the sole Supabase client and handles its own
-- authentication, so row-level security policies are unnecessary and
-- block operations when using the anon key.

ALTER TABLE IF EXISTS auth_codes       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_tokens      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS caregivers       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS people           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS photos           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sessions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recognition_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recognition_prefs  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_logs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memories         DISABLE ROW LEVEL SECURITY;

-- Ensure the memories table has the audio_url column (may be missing
-- if the table was created before the migration added it).
ALTER TABLE IF EXISTS memories ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Also allow anon role to use the memory-audio storage bucket,
-- since the server connects with the anon key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow anon uploads to memory-audio'
      AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow anon uploads to memory-audio"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'memory-audio');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow anon reads from memory-audio'
      AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow anon reads from memory-audio"
    ON storage.objects FOR SELECT
    TO anon
    USING (bucket_id = 'memory-audio');
  END IF;
END
$$;
