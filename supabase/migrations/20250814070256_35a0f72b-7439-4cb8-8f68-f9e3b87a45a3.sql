-- Force cleanup of all existing "Knowledge Chat Session" entries
DELETE FROM chat_messages 
WHERE conversation_id IN (
  SELECT id FROM chat_conversations 
  WHERE title = 'Knowledge Chat Session'
);

DELETE FROM chat_conversations 
WHERE title = 'Knowledge Chat Session';

-- Ensure user_preferences exists for all users to prevent migration loops
INSERT INTO user_preferences (user_id, migration_completed)
SELECT DISTINCT user_id, true
FROM chat_conversations
WHERE NOT EXISTS (
  SELECT 1 FROM user_preferences WHERE user_preferences.user_id = chat_conversations.user_id
);

-- Update existing preferences to mark migration as completed
UPDATE user_preferences 
SET migration_completed = true, updated_at = now()
WHERE migration_completed IS NULL OR migration_completed = false;

-- Drop existing constraint if it exists (to avoid conflicts)
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS unique_user_title_when_not_null;

-- Add improved constraint to prevent duplicate generic conversations
ALTER TABLE chat_conversations 
ADD CONSTRAINT unique_user_title_when_not_generic 
EXCLUDE (user_id WITH =, title WITH =) 
WHERE (title IS NOT NULL AND title != '' AND title != 'Knowledge Chat Session' AND title != 'New Chat');

-- Recreate the title generation function
CREATE OR REPLACE FUNCTION generate_chat_title()
RETURNS TEXT AS $$
BEGIN
  RETURN 'Chat ' || TO_CHAR(now(), 'YYYY-MM-DD HH24:MI:SS');
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger function with better logic
CREATE OR REPLACE FUNCTION prevent_generic_titles()
RETURNS TRIGGER AS $$
BEGIN
  -- Replace generic titles with timestamped ones
  IF NEW.title IS NULL OR NEW.title = '' OR NEW.title = 'Knowledge Chat Session' OR NEW.title = 'New Chat' THEN
    NEW.title := generate_chat_title();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS ensure_unique_titles ON chat_conversations;

-- Create the trigger
CREATE TRIGGER ensure_unique_titles
  BEFORE INSERT OR UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_generic_titles();