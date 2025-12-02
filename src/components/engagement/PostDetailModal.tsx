import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { useSuggestedReplies } from '@/hooks/useSuggestedReplies';
import { useRedditActions } from '@/hooks/useRedditActions';
import { useRedditComments } from '@/hooks/useRedditComments';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface PostDetailModalProps {
  post: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailModal({ post, open, onOpenChange }: PostDetailModalProps) {
  // Handle both object and array responses for post_reviews (one-to-one relationship)
  const review = post?.post_reviews 
    ? (Array.isArray(post.post_reviews) ? post.post_reviews[0] : post.post_reviews)
    : null;
  const reply = post?.suggested_replies?.[0];
  const [editedReply, setEditedReply] = useState(reply?.edited_reply || reply?.suggested_reply || '');
  const { updateReply } = useSuggestedReplies();

  // Sync editedReply state when reply data changes
  useEffect(() => {
    setEditedReply(reply?.edited_reply || reply?.suggested_reply || '');
  }, [reply?.edited_reply, reply?.suggested_reply]);
  const { analyzePost, generateReply } = useRedditActions();
  const { fetchComments } = useRedditComments();
  const { toast } = useToast();

  if (!post) return null;

  const handleCopyReply = () => {
    navigator.clipboard.writeText(editedReply);
    toast({
      title: "Copied to clipboard",
      description: "Reply copied successfully.",
    });
  };

  const handleApprove = () => {
    if (reply) {
      updateReply.mutate({ 
        replyId: reply.id, 
        editedReply,
        status: 'approved' 
      });
    }
  };

  const handleMarkPosted = () => {
    if (reply) {
      updateReply.mutate({ 
        replyId: reply.id, 
        status: 'posted' 
      });
    }
  };

  const handleReanalyze = () => {
    analyzePost.mutate({ postId: post.id, post });
  };

  const handleRegenerateReply = () => {
    if (review) {
      generateReply.mutate({
        postId: post.id,
        reviewId: review.id,
        post,
        review
      });
    }
  };

  const handleRefreshComments = () => {
    fetchComments.mutate({ postId: post.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {post.title}
            <Button variant="ghost" size="icon" asChild>
              <a href={post.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            {review && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleReanalyze}
                disabled={analyzePost.isPending}
                title="Re-analyze post"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${analyzePost.isPending ? 'animate-spin' : ''}`} />
                Re-analyze
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>by {post.author || 'Unknown'}</span>
            <span>•</span>
            <span>{post.pub_date ? new Date(post.pub_date).toLocaleDateString() : 'Unknown date'}</span>
          </div>

          {post.content && (
            <div className="prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
            </div>
          )}

          {review && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="scores">Scores</TabsTrigger>
                <TabsTrigger value="strategy">Strategy</TabsTrigger>
                <TabsTrigger value="reply">Reply</TabsTrigger>
                <TabsTrigger value="comments">
                  Comments ({post.comment_count || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Recommendation</h4>
                  <Badge variant={review.recommendation === 'high_priority' ? 'destructive' : 'default'}>
                    {review.recommendation?.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Relevance Score: {review.relevance_score}/100
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Reasoning</h4>
                  <p className="text-sm">{review.reasoning}</p>
                </div>
              </TabsContent>

              <TabsContent value="scores" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ScoreItem label="Problem Fit" score={review.problem_fit_score} />
                  <ScoreItem label="Audience Quality" score={review.audience_quality_score} />
                  <ScoreItem label="Engagement Potential" score={review.engagement_potential_score} />
                  <ScoreItem label="Timing" score={review.timing_score} />
                  <ScoreItem label="Strategic Value" score={review.strategic_value_score} />
                  <div>
                    <p className="text-sm font-semibold">Estimated Effort</p>
                    <Badge variant="outline">{review.estimated_effort?.toUpperCase()}</Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="strategy" className="space-y-4">
                {review.key_themes && (
                  <div>
                    <h4 className="font-semibold mb-2">Key Themes</h4>
                    <p className="text-sm">{review.key_themes}</p>
                  </div>
                )}
                {review.sentra_angles && (
                  <div>
                    <h4 className="font-semibold mb-2">Sentra Angles</h4>
                    <p className="text-sm">{review.sentra_angles}</p>
                  </div>
                )}
                {review.engagement_approach && (
                  <div>
                    <h4 className="font-semibold mb-2">Engagement Approach</h4>
                    <p className="text-sm">{review.engagement_approach}</p>
                  </div>
                )}
                {review.suggested_tone && (
                  <div>
                    <h4 className="font-semibold mb-2">Suggested Tone</h4>
                    <p className="text-sm">{review.suggested_tone}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reply" className="space-y-4">
                {reply ? (
                  <>
                    <div>
                      <h4 className="font-semibold mb-2">Suggested Reply</h4>
                      <Textarea
                        value={editedReply}
                        onChange={(e) => setEditedReply(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCopyReply} variant="outline">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </Button>
                      <Button 
                        onClick={handleRegenerateReply}
                        variant="outline"
                        disabled={generateReply.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${generateReply.isPending ? 'animate-spin' : ''}`} />
                        Regenerate Reply
                      </Button>
                      {reply.status !== 'approved' && reply.status !== 'posted' && (
                        <Button onClick={handleApprove}>
                          Approve
                        </Button>
                      )}
                      {reply.status !== 'posted' && (
                        <Button onClick={handleMarkPosted} variant="default">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark as Posted
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">No reply generated yet.</p>
                    {review && (
                      <Button 
                        onClick={handleRegenerateReply}
                        disabled={generateReply.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${generateReply.isPending ? 'animate-spin' : ''}`} />
                        Generate Reply
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Comments</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefreshComments}
                    disabled={fetchComments.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${fetchComments.isPending ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                
                {post.top_comments && post.top_comments.length > 0 ? (
                  <div className="space-y-3">
                    {post.top_comments.map((comment: any, idx: number) => (
                      <Card key={idx} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">u/{comment.author}</span>
                          <Badge variant="secondary">{comment.score} upvotes</Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                        <span className="text-xs text-muted-foreground mt-2 block">
                          {formatDistanceToNow(new Date(comment.created_utc * 1000), { addSuffix: true })}
                        </span>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      {post.comment_count === 0 
                        ? 'No comments on this post yet.'
                        : 'Comments not fetched yet. Click refresh to load comments.'}
                    </p>
                  </div>
                )}
                
                {post.comments_fetched_at && (
                  <p className="text-xs text-muted-foreground text-center">
                    Last updated: {formatDistanceToNow(new Date(post.comments_fetched_at), { addSuffix: true })}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all" 
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">{score}</span>
      </div>
    </div>
  );
}
