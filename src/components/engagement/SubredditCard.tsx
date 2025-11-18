import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { TrackedSubreddit } from '@/hooks/useTrackedSubreddits';
import { useRedditActions } from '@/hooks/useRedditActions';
import { formatDistanceToNow } from 'date-fns';

interface SubredditCardProps {
  subreddit: TrackedSubreddit;
  onToggleActive: (id: string, isActive: boolean) => void;
  onRemove: (id: string) => void;
}

export function SubredditCard({ subreddit, onToggleActive, onRemove }: SubredditCardProps) {
  const { refreshPosts } = useRedditActions();
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">r/{subreddit.subreddit_name}</h3>
            <Badge variant={subreddit.is_active ? 'default' : 'secondary'}>
              {subreddit.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {subreddit.last_fetched_at 
              ? `Last fetched ${formatDistanceToNow(new Date(subreddit.last_fetched_at), { addSuffix: true })}`
              : 'Never fetched'}
          </p>
          <a 
            href={subreddit.rss_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            RSS Feed <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={subreddit.is_active}
            onCheckedChange={(checked) => onToggleActive(subreddit.id, checked)}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshPosts.mutate(subreddit.id)}
            disabled={refreshPosts.isPending}
            title="Refresh posts now"
          >
            <RefreshCw className={`h-4 w-4 ${refreshPosts.isPending ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(subreddit.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
