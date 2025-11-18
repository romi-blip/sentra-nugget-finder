import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, MessageSquare, CheckCircle, RefreshCw } from 'lucide-react';
import { useRedditActions } from '@/hooks/useRedditActions';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: any;
  onClick: () => void;
}

export function PostCard({ post, onClick }: PostCardProps) {
  const review = post.post_reviews?.[0];
  const reply = post.suggested_replies?.[0];
  const { analyzePost } = useRedditActions();
  
  const getPriorityColor = (recommendation: string) => {
    switch (recommendation) {
      case 'high_priority':
        return 'destructive';
      case 'medium_priority':
        return 'default';
      case 'low_priority':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPriorityLabel = (recommendation: string) => {
    return recommendation?.replace('_', ' ').toUpperCase() || 'UNREVIEWED';
  };

  const handleReanalyze = (e: React.MouseEvent) => {
    e.stopPropagation();
    analyzePost.mutate({ postId: post.id, post });
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {review && (
                <Badge variant={getPriorityColor(review.recommendation)}>
                  {getPriorityLabel(review.recommendation)}
                </Badge>
              )}
              {review?.relevance_score && (
                <Badge variant="outline">Score: {review.relevance_score}</Badge>
              )}
              {reply && (
                <Badge variant={reply.status === 'posted' ? 'default' : 'secondary'}>
                  {reply.status === 'posted' ? <CheckCircle className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                  {reply.status}
                </Badge>
              )}
            </div>
            <h3 className="font-semibold line-clamp-2">{post.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{post.author || 'Unknown'}</span>
              <span>•</span>
              <span>{post.pub_date && formatDistanceToNow(new Date(post.pub_date), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleReanalyze}
              disabled={analyzePost.isPending}
              title={review ? "Re-analyze post" : "Analyze post"}
            >
              <RefreshCw className={`h-4 w-4 ${analyzePost.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" asChild onClick={(e) => e.stopPropagation()}>
              <a href={post.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
        
        {post.content_snippet && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {post.content_snippet.replace(/<[^>]*>/g, '')}
          </p>
        )}

        {review?.key_themes && (
          <div className="flex gap-1 flex-wrap">
            {review.key_themes.split('|').map((theme: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {theme.trim()}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
