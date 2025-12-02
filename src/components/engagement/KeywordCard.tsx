import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tag, Trash2, Clock, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { TrackedKeyword } from '@/hooks/useTrackedKeywords';
import { useRedditActions } from '@/hooks/useRedditActions';

interface KeywordCardProps {
  keyword: TrackedKeyword;
  onToggle: (id: string, isActive: boolean) => void;
  onRemove: (id: string) => void;
}

export function KeywordCard({ keyword, onToggle, onRemove }: KeywordCardProps) {
  const { refreshKeywordPosts } = useRedditActions();
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
      </CardContent>
    </Card>
  );
}