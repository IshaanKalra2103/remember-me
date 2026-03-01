-- Remove legacy patient PIN storage.
ALTER TABLE patients DROP COLUMN IF EXISTS pin_hash;

-- Store diarized conversation memories captured in patient mode.
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  person_name TEXT NOT NULL,
  transcription TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
