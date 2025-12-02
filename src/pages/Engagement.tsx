import { useState } from 'react';
import SEO from '@/components/SEO';
import { useTrackedSubreddits } from '@/hooks/useTrackedSubreddits';
import { useTrackedKeywords } from '@/hooks/useTrackedKeywords';
import { useRedditPosts, type RedditPost } from '@/hooks/useRedditPosts';
import { useRedditActions } from '@/hooks/useRedditActions';
import { SubredditManager } from '@/components/engagement/SubredditManager';
import { SubredditCard } from '@/components/engagement/SubredditCard';
import { KeywordManager } from '@/components/engagement/KeywordManager';
import { KeywordCard } from '@/components/engagement/KeywordCard';
import { PostCard } from '@/components/engagement/PostCard';
import { PostDetailModal } from '@/components/engagement/PostDetailModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, TrendingUp, Clock, CheckCircle, CheckSquare, Square, FilterX, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Engagement = () => {
  const { 
    subreddits, 
    isLoading: isLoadingSubreddits,
    addSubreddit,
    toggleActive,
    removeSubreddit 
  } = useTrackedSubreddits();

  const {
    keywords,
    isLoading: isLoadingKeywords,
    addKeyword,
    toggleActive: toggleKeywordActive,
    updateNegativeKeywords,
    removeKeyword,
    toggleCommentSearch
  } = useTrackedKeywords();
  
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const { analyzePost, deletePosts } = useRedditActions();
  const { toast } = useToast();

  const { posts: rawPosts, totalCount, isLoading: isLoadingPosts } = useRedditPosts({
    subredditIds: selectedSubreddits.length > 0 ? selectedSubreddits : undefined,
    keywordIds: selectedKeywords.length > 0 ? selectedKeywords : undefined,
    priority: priority !== 'all' ? priority : undefined,
    status: status !== 'all' ? status : undefined,
    page: currentPage,
    pageSize: pageSize,
  });

  // Apply client-side sorting
  const posts: RedditPost[] = [...rawPosts].sort((a, b) => {
    switch (sortBy) {
      case 'comments':
        return (b.comment_count || 0) - (a.comment_count || 0);
      case 'priority':
        const priorityOrder = { high_priority: 3, medium_priority: 2, low_priority: 1 };
        const aReview = Array.isArray((a as any).post_reviews) ? (a as any).post_reviews[0] : (a as any).post_reviews;
        const bReview = Array.isArray((b as any).post_reviews) ? (b as any).post_reviews[0] : (b as any).post_reviews;
        const aPriority = priorityOrder[aReview?.recommendation as keyof typeof priorityOrder] || 0;
        const bPriority = priorityOrder[bReview?.recommendation as keyof typeof priorityOrder] || 0;
        return bPriority - aPriority;
      case 'recent':
      default:
        return new Date(b.pub_date || 0).getTime() - new Date(a.pub_date || 0).getTime();
    }
  });

  const handleAddKeyword = (keyword: string) => {
    addKeyword.mutate(keyword);
  };

  const handleToggleKeywordActive = (id: string, isActive: boolean) => {
    toggleKeywordActive.mutate({ id, isActive });
  };

  const handleUpdateNegativeKeywords = (id: string, negativeKeywords: string[]) => {
    updateNegativeKeywords.mutate({ id, negativeKeywords });
  };

  const handleRemoveKeyword = (id: string) => {
    removeKeyword.mutate(id);
  };

  const handleToggleCommentSearch = (id: string, searchComments: boolean) => {
    toggleCommentSearch.mutate({ id, searchComments });
  };

  const handleAddSubreddit = (name: string) => {
    addSubreddit.mutate(name);
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActive.mutate({ id, isActive });
  };

  const handleRemoveSubreddit = (id: string) => {
    removeSubreddit.mutate(id);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedPosts(new Set());
    }
  };

  const handlePostSelection = (postId: string, selected: boolean) => {
    const newSelected = new Set(selectedPosts);
    if (selected) {
      newSelected.add(postId);
    } else {
      newSelected.delete(postId);
    }
    setSelectedPosts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map((p: any) => p.id)));
    }
  };

  const handleSelectUnanalyzed = () => {
    const unanalyzedPosts = posts.filter((p: any) => 
      !p.post_reviews || (Array.isArray(p.post_reviews) && p.post_reviews.length === 0)
    );
    setSelectedPosts(new Set(unanalyzedPosts.map((p: any) => p.id)));
  };

  const handleBulkAnalyze = async () => {
    const postsToAnalyze = posts.filter((p: any) => selectedPosts.has(p.id));
    toast({
      title: "Analyzing posts",
      description: `Starting analysis of ${postsToAnalyze.length} posts...`,
    });

    for (const post of postsToAnalyze) {
      try {
        await analyzePost.mutateAsync({ postId: post.id, post });
      } catch (error) {
        console.error(`Failed to analyze post ${post.id}:`, error);
      }
    }

    toast({
      title: "Analysis complete",
      description: `Finished analyzing ${postsToAnalyze.length} posts.`,
    });
    setSelectedPosts(new Set());
  };

  const handleBulkDelete = async () => {
    const postIds = Array.from(selectedPosts);
    if (postIds.length === 0) return;
    
    try {
      await deletePosts.mutateAsync(postIds);
      setSelectedPosts(new Set());
    } catch (error) {
      console.error('Failed to delete posts:', error);
    }
  };

  const handleClearFilters = () => {
    setSelectedSubreddits([]);
    setSelectedKeywords([]);
    setPriority('all');
    setStatus('all');
    setSortBy('recent');
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedSubreddits.length > 0 || selectedKeywords.length > 0 || priority !== 'all' || status !== 'all';
  const totalPages = Math.ceil(totalCount / pageSize);

  const activeSubreddits = subreddits.filter(s => s.is_active).length;
  const activeKeywords = keywords.filter(k => k.is_active).length;
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
            Track subreddits, keywords and get AI-powered engagement suggestions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquarePlus className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{subreddits.length + keywords.length}</p>
                <p className="text-xs text-muted-foreground">Total Tracked</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activeSubreddits + activeKeywords}</p>
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

        <Collapsible defaultOpen={false}>
          <Card className="p-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <h2 className="text-lg font-semibold">Manage Tracked Sources</h2>
              <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <Tabs defaultValue="subreddits" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="subreddits">Subreddits</TabsTrigger>
                  <TabsTrigger value="keywords">Keywords</TabsTrigger>
                </TabsList>

                <TabsContent value="subreddits" className="space-y-4">
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Add Subreddit</h2>
                    <SubredditManager 
                      onAdd={handleAddSubreddit}
                      isAdding={addSubreddit.isPending}
                    />
                  </Card>

                  {subreddits.length > 0 && (
                    <Collapsible defaultOpen>
                      <Card className="p-6">
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                          <h2 className="text-xl font-semibold">Tracked Subreddits ({subreddits.length})</h2>
                          <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4">
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
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )}
                </TabsContent>

                <TabsContent value="keywords" className="space-y-4">
                  <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Add Keyword</h2>
                    <KeywordManager 
                      onAdd={handleAddKeyword}
                      isAdding={addKeyword.isPending}
                    />
                  </Card>

                  {keywords.length > 0 && (
                    <Collapsible defaultOpen>
                      <Card className="p-6">
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                          <h2 className="text-xl font-semibold">Tracked Keywords ({keywords.length})</h2>
                          <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {keywords.map((keyword) => (
                              <KeywordCard
                                key={keyword.id}
                                keyword={keyword}
                                onToggle={handleToggleKeywordActive}
                                onRemove={handleRemoveKeyword}
                                onUpdateNegativeKeywords={handleUpdateNegativeKeywords}
                                onToggleCommentSearch={handleToggleCommentSearch}
                              />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )}
                </TabsContent>
              </Tabs>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Posts Feed</h2>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={selectionMode ? "default" : "outline"}
                onClick={toggleSelectionMode}
              >
                {selectionMode ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                {selectionMode ? 'Exit Selection' : 'Select Posts'}
              </Button>

              <Select 
                value={selectedSubreddits.length === 0 ? 'all' : selectedSubreddits[0]} 
                onValueChange={(value) => {
                  setSelectedSubreddits(value === 'all' ? [] : [value]);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px] sm:w-[180px]">
                  <SelectValue placeholder="Filter by subreddit" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All Subreddits</SelectItem>
                  {subreddits.map((subreddit) => (
                    <SelectItem key={subreddit.id} value={subreddit.id}>
                      r/{subreddit.subreddit_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={selectedKeywords.length === 0 ? 'all' : selectedKeywords[0]} 
                onValueChange={(value) => {
                  setSelectedKeywords(value === 'all' ? [] : [value]);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[150px] sm:w-[180px]">
                  <SelectValue placeholder="Filter by keyword" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All Keywords</SelectItem>
                  {keywords.map((keyword) => (
                    <SelectItem key={keyword.id} value={keyword.id}>
                      {keyword.keyword}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-[150px] sm:w-[180px]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high_priority">High Priority</SelectItem>
                  <SelectItem value="medium_priority">Medium Priority</SelectItem>
                  <SelectItem value="low_priority">Low Priority</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px] sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="no_reply">No Reply</SelectItem>
                  <SelectItem value="has_reply">Has Reply</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="high_engagement">High Engagement (50+ comments)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px] sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="comments">Most Comments</SelectItem>
                  <SelectItem value="priority">Highest Priority</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters}>
                  <FilterX className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {selectionMode && (
            <Card className="p-4 mb-4 bg-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <p className="font-medium">
                    {selectedPosts.size > 0 
                      ? `${selectedPosts.size} post${selectedPosts.size !== 1 ? 's' : ''} selected`
                      : 'No posts selected'
                    }
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedPosts.size === posts.length && posts.length > 0 ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSelectUnanalyzed}>
                      Select Unanalyzed
                    </Button>
                  </div>
                </div>
                {selectedPosts.size > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleBulkAnalyze}
                      disabled={analyzePost.isPending}
                    >
                      Analyze Selected ({selectedPosts.size})
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={deletePosts.isPending}
                    >
                      Delete Selected ({selectedPosts.size})
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {isLoadingPosts ? (
            <p className="text-center text-muted-foreground py-8">Loading posts...</p>
          ) : posts.length === 0 ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">
                No posts yet. Add some subreddits to start tracking!
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {posts.map((post: any) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onClick={() => !selectionMode && setSelectedPost(post)}
                    selectionMode={selectionMode}
                    isSelected={selectedPosts.has(post.id)}
                    onSelectChange={(selected) => handlePostSelection(post.id, selected)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                    </span>
                  </div>

                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
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
