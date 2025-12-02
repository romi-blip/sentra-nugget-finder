import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tag, Trash2, Clock, RefreshCw, X, Plus, Ban } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { TrackedKeyword } from '@/hooks/useTrackedKeywords';
import { useRedditActions } from '@/hooks/useRedditActions';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface KeywordCardProps {
  keyword: TrackedKeyword;
  onToggle: (id: string, isActive: boolean) => void;
  onRemove: (id: string) => void;
  onUpdateNegativeKeywords: (id: string, negativeKeywords: string[]) => void;
}

export function KeywordCard({ keyword, onToggle, onRemove, onUpdateNegativeKeywords }: KeywordCardProps) {
  const { refreshKeywordPosts } = useRedditActions();
  const [isOpen, setIsOpen] = useState(false);
  const [newNegativeKeyword, setNewNegativeKeyword] = useState('');
  
  const negativeKeywords = keyword.negative_keywords || [];

  const handleAddNegativeKeyword = () => {
    if (!newNegativeKeyword.trim()) return;
    const updated = [...negativeKeywords, newNegativeKeyword.trim().toLowerCase()];
    onUpdateNegativeKeywords(keyword.id, updated);
    setNewNegativeKeyword('');
  };

  const handleRemoveNegativeKeyword = (index: number) => {
    const updated = negativeKeywords.filter((_, i) => i !== index);
    onUpdateNegativeKeywords(keyword.id, updated);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNegativeKeyword();
    }
  };

  return (
    <Card className={!keyword.is_active ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{keyword.keyword}</span>
                <Badge variant={keyword.is_active ? 'default' : 'secondary'}>
                  {keyword.is_active ? 'Active' : 'Paused'}
                </Badge>
                {negativeKeywords.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Ban className="h-3 w-3 mr-1" />
                    {negativeKeywords.length} excluded
                  </Badge>
                )}
              </div>
              {keyword.last_fetched_at && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  Last fetched: {new Date(keyword.last_fetched_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refreshKeywordPosts.mutate()}
              disabled={refreshKeywordPosts.isPending}
              title="Refresh keyword posts"
            >
              <RefreshCw className={`h-4 w-4 ${refreshKeywordPosts.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Switch
              checked={keyword.is_active}
              onCheckedChange={(checked) => onToggle(keyword.id, checked)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(keyword.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground">
              <Ban className="h-3 w-3 mr-2" />
              {isOpen ? 'Hide' : 'Manage'} negative keywords
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add negative keyword (e.g., Nissan)"
                value={newNegativeKeyword}
                onChange={(e) => setNewNegativeKeyword(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 h-8 text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleAddNegativeKeyword}
                disabled={!newNegativeKeyword.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {negativeKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {negativeKeywords.map((nk, index) => (
                  <Badge key={index} variant="secondary" className="pr-1">
                    {nk}
                    <button
                      onClick={() => handleRemoveNegativeKeyword(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {negativeKeywords.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No negative keywords. Posts containing negative keywords will be filtered out during fetch.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
