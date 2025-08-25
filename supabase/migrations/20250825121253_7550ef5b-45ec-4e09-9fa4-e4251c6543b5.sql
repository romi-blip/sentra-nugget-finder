-- Add DELETE policies for chat conversations and messages
CREATE POLICY "Users can delete their own conversations" 
ON public.chat_conversations 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete messages in their conversations" 
ON public.chat_messages 
FOR DELETE 
USING (EXISTS (
  SELECT 1 
  FROM chat_conversations c 
  WHERE c.id = chat_messages.conversation_id 
    AND c.user_id = auth.uid()
));