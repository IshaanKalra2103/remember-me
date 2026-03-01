-- Add Gemini-powered smart memory fields.
-- bio: rolling 3-sentence profile summary updated by Gemini after important conversations.
-- topics_to_avoid: JSON list of subjects Gemini should never surface in whispers.
ALTER TABLE people ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE people ADD COLUMN IF NOT EXISTS topics_to_avoid JSONB DEFAULT '[]'::jsonb;

-- is_important: Gemini classification — true if conversation contained significant life info.
-- summary: one-sentence Gemini summary of the conversation transcript.
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS summary TEXT;
