
-- Allow super_admin to read all conversations and messages for analytics
-- (existing user-specific policies remain in place)

-- 1) chat_conversations: super_admin can SELECT all rows
CREATE POLICY "Super admins can view all conversations"
  ON public.chat_conversations
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2) chat_messages: super_admin can SELECT all rows
CREATE POLICY "Super admins can view all messages"
  ON public.chat_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Helpful indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages (created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
  ON public.chat_messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
  ON public.chat_conversations (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at
  ON public.chat_conversations (created_at);
