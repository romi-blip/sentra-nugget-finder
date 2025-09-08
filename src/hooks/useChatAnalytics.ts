import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface ChatAnalytics {
  totalQuestions: number;
  uniqueUsers: number;
  avgQuestionsPerUser: number;
  totalConversations: number;
  timeSeriesData: Array<{ date: string; questions: number }>;
  topUsers: Array<{
    user_id: string;
    email: string;
    questionCount: number;
    lastAsked: string;
  }>;
  wordFrequencies: Array<{ word: string; count: number }>;
  recentQuestions: Array<{
    id: string;
    content: string;
    created_at: string;
    userEmail: string;
    conversationTitle?: string;
  }>;
}

interface DateRange {
  from: Date;
  to: Date;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'this', 'that', 'these', 'those', 'what', 'where', 'when', 'why', 'how', 'who', 'which',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'her', 'us', 'them',
  'if', 'then', 'else', 'than', 'as', 'so', 'too', 'very', 'just', 'now', 'here', 'there',
  'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'once', 'about', 'please'
]);

function processWordFrequencies(messages: Array<{ content: string }>): Array<{ word: string; count: number }> {
  const wordCounts = new Map<string, number>();
  
  messages.forEach(({ content }) => {
    // Clean and split text
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !STOP_WORDS.has(word) &&
        !/^\d+$/.test(word) // Exclude numbers
      );
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });
  
  return Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

export function useChatAnalytics(dateRange: DateRange) {
  const [data, setData] = useState<ChatAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setIsLoading(true);
        setError(null);

        const fromDate = dateRange.from.toISOString();
        const toDate = dateRange.to.toISOString();

        // Fetch conversations in date range
        const { data: conversations, error: convError } = await supabase
          .from('chat_conversations')
          .select('id, user_id, created_at, title')
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
          .order('created_at', { ascending: false });

        if (convError) throw convError;

        const conversationIds = conversations?.map(c => c.id) || [];
        
        if (conversationIds.length === 0) {
          setData({
            totalQuestions: 0,
            uniqueUsers: 0,
            avgQuestionsPerUser: 0,
            totalConversations: 0,
            timeSeriesData: [],
            topUsers: [],
            wordFrequencies: [],
            recentQuestions: [],
          });
          return;
        }

        // Fetch user messages from those conversations
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('id, conversation_id, role, content, created_at')
          .in('conversation_id', conversationIds)
          .eq('role', 'user')
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
          .order('created_at', { ascending: false });

        if (msgError) throw msgError;

        // Fetch user profiles for email mapping
        const userIds = [...new Set(conversations?.map(c => c.user_id) || [])];
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        if (profileError) throw profileError;

        const userEmailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

        // Process analytics
        const totalQuestions = messages?.length || 0;
        const uniqueUsers = new Set(conversations?.map(c => c.user_id)).size;
        const avgQuestionsPerUser = uniqueUsers > 0 ? totalQuestions / uniqueUsers : 0;
        const totalConversations = conversations?.length || 0;

        // Time series data
        const dailyCounts = new Map<string, number>();
        messages?.forEach(msg => {
          const date = format(new Date(msg.created_at), 'MMM dd');
          dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
        });

        const timeSeriesData = Array.from(dailyCounts.entries())
          .map(([date, questions]) => ({ date, questions }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Top users
        const userQuestionCounts = new Map<string, { count: number; lastAsked: string }>();
        messages?.forEach(msg => {
          const conv = conversations?.find(c => c.id === msg.conversation_id);
          if (conv) {
            const existing = userQuestionCounts.get(conv.user_id);
            userQuestionCounts.set(conv.user_id, {
              count: (existing?.count || 0) + 1,
              lastAsked: !existing || new Date(msg.created_at) > new Date(existing.lastAsked) 
                ? msg.created_at 
                : existing.lastAsked
            });
          }
        });

        const topUsers = Array.from(userQuestionCounts.entries())
          .map(([user_id, { count, lastAsked }]) => ({
            user_id,
            email: userEmailMap.get(user_id) || 'Unknown',
            questionCount: count,
            lastAsked,
          }))
          .sort((a, b) => b.questionCount - a.questionCount);

        // Word frequencies
        const wordFrequencies = processWordFrequencies(messages || []);

        // Recent questions
        const recentQuestions = messages?.slice(0, 50).map(msg => {
          const conv = conversations?.find(c => c.id === msg.conversation_id);
          return {
            id: msg.id,
            content: msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content,
            created_at: msg.created_at,
            userEmail: userEmailMap.get(conv?.user_id || '') || 'Unknown',
            conversationTitle: conv?.title,
          };
        }) || [];

        setData({
          totalQuestions,
          uniqueUsers,
          avgQuestionsPerUser,
          totalConversations,
          timeSeriesData,
          topUsers,
          wordFrequencies,
          recentQuestions,
        });

      } catch (err) {
        console.error('Error fetching chat analytics:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange.from, dateRange.to]);

  return { data, isLoading, error };
}