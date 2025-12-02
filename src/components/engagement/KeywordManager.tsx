import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from 'lucide-react';

interface KeywordManagerProps {
  onAdd: (keyword: string) => void;
  isAdding: boolean;
}

export function KeywordManager({ onAdd, isAdding }: KeywordManagerProps) {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    
    onAdd(keyword.trim());
    setKeyword('');
  };

  return (
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
  );
}