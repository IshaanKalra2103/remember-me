-- Migration: Add RLS policies for memory-audio storage bucket
-- Run this in your Supabase SQL Editor

-- Create the memory-audio bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('memory-audio', 'memory-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to memory-audio bucket
-- (Server uses service role key, so this is mainly for completeness)
CREATE POLICY "Allow authenticated uploads to memory-audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'memory-audio');

-- Allow authenticated users to read from memory-audio bucket
CREATE POLICY "Allow authenticated reads from memory-audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'memory-audio');

-- Allow service role full access (this is default, but explicit is better)
-- Note: Service role bypasses RLS, so these policies are for anon/authenticated users

-- For server-side operations, use SUPABASE_SERVICE_ROLE_KEY instead of SUPABASE_KEY
-- The service role key bypasses RLS entirely
