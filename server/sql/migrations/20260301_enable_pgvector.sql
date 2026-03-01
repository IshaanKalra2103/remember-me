-- Enable pgvector extension for storing voice embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column for TitaNet voice embeddings (192 dimensions)
-- For now, voice_embedding stores 'uploaded' as placeholder
-- Future: Store actual TitaNet embeddings as vector(192)
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS voice_embedding_vector vector(192);

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_patients_voice_embedding
ON patients USING ivfflat (voice_embedding_vector vector_cosine_ops)
WITH (lists = 100);

-- Comment explaining the columns
COMMENT ON COLUMN patients.voice_embedding IS 'Legacy: stores "uploaded" when voice sample exists';
COMMENT ON COLUMN patients.voice_embedding_vector IS 'TitaNet 192-dim voice embedding for speaker identification';
