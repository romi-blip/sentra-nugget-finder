import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

interface SubredditManagerProps {
  onAdd: (subredditName: string) => void;
  isAdding: boolean;
}

export function SubredditManager({ onAdd, isAdding }: SubredditManagerProps) {
  const [subredditName, setSubredditName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subredditName.trim()) return;
    
    const cleanName = subredditName.trim().replace(/^r\//, '');
    onAdd(cleanName);
    setSubredditName('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Enter subreddit name (e.g., cybersecurity)"
        value={subredditName}
        onChange={(e) => setSubredditName(e.target.value)}
        disabled={isAdding}
        className="flex-1"
      />
      <Button type="submit" disabled={isAdding || !subredditName.trim()}>
        <Plus className="h-4 w-4 mr-2" />
        {isAdding ? 'Adding...' : 'Add Subreddit'}
      </Button>
    </form>
  );
}
