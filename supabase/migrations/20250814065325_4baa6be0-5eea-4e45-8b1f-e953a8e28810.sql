-- Step 1: Clean up existing "Knowledge Chat Session" entries
DELETE FROM chat_messages 
WHERE conversation_id IN (
  SELECT id FROM chat_conversations 
  WHERE title = 'Knowledge Chat Session' 
  AND user_id = auth.uid()
);

DELETE FROM chat_conversations 
WHERE title = 'Knowledge Chat Session' 
AND user_id = auth.uid();

-- Step 2: Ensure user_preferences exists and migration is marked complete
INSERT INTO user_preferences (user_id, migration_completed)
VALUES (auth.uid(), true)
ON CONFLICT (user_id) 
DO UPDATE SET migration_completed = true, updated_at = now();

-- Step 3: Add constraints to prevent duplicate conversations
ALTER TABLE chat_conversations 
ADD CONSTRAINT unique_user_title_when_not_null 
EXCLUDE (user_id WITH =, title WITH =) 
WHERE (title IS NOT NULL AND title != '');

-- Step 4: Add function to generate better default titles
CREATE OR REPLACE FUNCTION generate_chat_title()
RETURNS TEXT AS $$
BEGIN
  RETURN 'Chat ' || TO_CHAR(now(), 'YYYY-MM-DD HH24:MI');
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add trigger to prevent generic titles
CREATE OR REPLACE FUNCTION prevent_generic_titles()
RETURNS TRIGGER AS $$
BEGIN
  -- Replace generic titles with timestamped ones
  IF NEW.title = 'Knowledge Chat Session' OR NEW.title = 'New Chat' THEN
    NEW.title := generate_chat_title();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_unique_titles
  BEFORE INSERT OR UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_generic_titles();