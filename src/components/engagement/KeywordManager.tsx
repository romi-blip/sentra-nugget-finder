import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface KeywordManagerProps {
  onAdd: (keyword: string) => void;
  isAdding: boolean;
}

export function KeywordManager({ onAdd, isAdding }: KeywordManagerProps) {
  const [keyword, setKeyword] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    
    onAdd(keyword.trim());
    setKeyword('');
  };

  const handleRefreshAllPosts = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-keyword-post-data');
      
      if (error) throw error;
      
      toast.success(`Refreshed ${data?.updated || 0} posts with complete data`);
      queryClient.invalidateQueries({ queryKey: ['reddit-posts'] });
    } catch (err: any) {
      console.error('Error refreshing posts:', err);
      toast.error(`Failed to refresh posts: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="Enter keyword (e.g., data security)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          disabled={isAdding}
          className="flex-1"
        />
        <Button type="submit" disabled={isAdding || !keyword.trim()}>
          <Tag className="h-4 w-4 mr-2" />
          {isAdding ? 'Adding...' : 'Add Keyword'}
        </Button>
      </form>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleRefreshAllPosts}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing Posts...' : 'Refresh All Keyword Posts'}
      </Button>
    </div>
  );
}