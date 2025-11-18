import { useState } from 'react';
import SEO from '@/components/SEO';
import { useTrackedSubreddits } from '@/hooks/useTrackedSubreddits';
import { useRedditPosts } from '@/hooks/useRedditPosts';
import { SubredditManager } from '@/components/engagement/SubredditManager';
import { SubredditCard } from '@/components/engagement/SubredditCard';
import { PostCard } from '@/components/engagement/PostCard';
import { PostDetailModal } from '@/components/engagement/PostDetailModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from '@/components/ui/card';
import { MessageSquarePlus, TrendingUp, Clock, CheckCircle } from 'lucide-react';

const Engagement = () => {
  const { 
    subreddits, 
    isLoading: isLoadingSubreddits,
    addSubreddit,
    toggleActive,
    removeSubreddit 
  } = useTrackedSubreddits();
  
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const { posts, isLoading: isLoadingPosts } = useRedditPosts({
    subredditIds: selectedSubreddits.length > 0 ? selectedSubreddits : undefined,
    priority: priority !== 'all' ? priority : undefined,
    status: status !== 'all' ? status : undefined,
  });

  const handleAddSubreddit = (name: string) => {
    addSubreddit.mutate(name);
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActive.mutate({ id, isActive });
  };

  const handleRemoveSubreddit = (id: string) => {
    removeSubreddit.mutate(id);
  };

  const activeSubreddits = subreddits.filter(s => s.is_active).length;
  const postsToday = posts.filter((p: any) => {
    const postDate = new Date(p.pub_date);
    const today = new Date();
    return postDate.toDateString() === today.toDateString();
  }).length;
  const pendingReplies = posts.filter((p: any) => 
    p.suggested_replies?.[0]?.status === 'pending'
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Reddit Engagement"
        description="Track and engage with relevant Reddit posts"
      />
      
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reddit Engagement</h1>
          <p className="text-muted-foreground">
            Track subreddits and get AI-powered engagement suggestions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquarePlus className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{subreddits.length}</p>
                <p className="text-xs text-muted-foreground">Total Tracked</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activeSubreddits}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{postsToday}</p>
                <p className="text-xs text-muted-foreground">Posts Today</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{pendingReplies}</p>
                <p className="text-xs text-muted-foreground">Pending Replies</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add Subreddit</h2>
          <SubredditManager 
            onAdd={handleAddSubreddit}
            isAdding={addSubreddit.isPending}
          />
        </Card>

        {subreddits.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Tracked Subreddits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subreddits.map((subreddit) => (
                <SubredditCard
                  key={subreddit.id}
                  subreddit={subreddit}
                  onToggleActive={handleToggleActive}
                  onRemove={handleRemoveSubreddit}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Posts Feed</h2>
            <div className="flex gap-2">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high_priority">High Priority</SelectItem>
                  <SelectItem value="medium_priority">Medium Priority</SelectItem>
                  <SelectItem value="low_priority">Low Priority</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="no_reply">No Reply</SelectItem>
                  <SelectItem value="has_reply">Has Reply</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingPosts ? (
            <p className="text-center text-muted-foreground py-8">Loading posts...</p>
          ) : posts.length === 0 ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">
                No posts yet. Add some subreddits to start tracking!
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {posts.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => setSelectedPost(post)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      />
    </div>
  );
};

export default Engagement;
