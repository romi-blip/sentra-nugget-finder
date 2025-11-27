import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  User, Building2, Mail, Globe, Linkedin, MapPin, Briefcase, 
  RefreshCw, Loader2, ExternalLink, Clock, MessageSquare, Newspaper
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLeadResearchDetail } from '@/hooks/useLeadResearch';

interface LeadResearchDetailProps {
  researchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LeadResearchDetail({ researchId, open, onOpenChange }: LeadResearchDetailProps) {
  const { research, feedItems, isLoading, refreshFeed, isRefreshing } = useLeadResearchDetail(researchId);

  if (!researchId) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'researching':
        return <Badge variant="default" className="animate-pulse">Researching...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFeedIcon = (type: string) => {
    switch (type) {
      case 'linkedin_post':
        return <Linkedin className="h-4 w-4 text-blue-500" />;
      case 'twitter_post':
        return <MessageSquare className="h-4 w-4 text-sky-500" />;
      case 'news_mention':
        return <Newspaper className="h-4 w-4 text-orange-500" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const proseClasses = "prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary prose-strong:text-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        {isLoading || !research ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-xl">
                    {research.full_name || `${research.first_name || ''} ${research.last_name || ''}`.trim() || 'Lead Research'}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(research.status)}
                    <span className="text-sm text-muted-foreground">
                      via {research.input_type}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>

            {research.status === 'researching' ? (
              <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Researching lead...</p>
                <p className="text-sm text-muted-foreground">This may take a few minutes</p>
              </div>
            ) : research.status === 'failed' ? (
              <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-destructive">
                <p className="font-medium">Research failed</p>
                <p className="text-sm text-muted-foreground">{research.error_message || 'Unknown error'}</p>
              </div>
            ) : (
              <Tabs defaultValue="summary" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="feed">Activity Feed</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <ScrollArea className="h-[calc(100vh-250px)]">
                    {research.research_summary ? (
                      <div className={proseClasses}>
                        <ReactMarkdown>{research.research_summary}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>No summary available yet</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="details">
                  <ScrollArea className="h-[calc(100vh-250px)]">
                    <div className="space-y-6 pr-4">
                      {/* Contact Info */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Contact Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {research.full_name && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{research.full_name}</span>
                            </div>
                          )}
                          {research.title && (
                            <div className="flex items-center gap-2 text-sm">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span>{research.title}</span>
                            </div>
                          )}
                          {research.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <a href={`mailto:${research.email}`} className="text-primary hover:underline">
                                {research.email}
                              </a>
                            </div>
                          )}
                          {research.linkedin_url && (
                            <div className="flex items-center gap-2 text-sm">
                              <Linkedin className="h-4 w-4 text-muted-foreground" />
                              <a href={research.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                LinkedIn Profile
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {research.location && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{research.location}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Company Info */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Company Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {research.company_name && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{research.company_name}</span>
                            </div>
                          )}
                          {research.company_industry && (
                            <div className="flex items-center gap-2 text-sm">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span>{research.company_industry}</span>
                            </div>
                          )}
                          {research.company_size && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{research.company_size} employees</span>
                            </div>
                          )}
                          {research.company_website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <a href={research.company_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                {research.company_website}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {research.company_linkedin && (
                            <div className="flex items-center gap-2 text-sm">
                              <Linkedin className="h-4 w-4 text-muted-foreground" />
                              <a href={research.company_linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                Company LinkedIn
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="feed">
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => refreshFeed()}
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Refresh Feed
                      </Button>
                    </div>

                    <ScrollArea className="h-[calc(100vh-320px)]">
                      {feedItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No activity found</p>
                          <p className="text-sm">Click refresh to fetch latest activity</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pr-4">
                          {feedItems.map((item) => (
                            <Card key={item.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="mt-1">
                                    {getFeedIcon(item.feed_type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {item.title && (
                                      <h4 className="font-medium text-sm truncate">{item.title}</h4>
                                    )}
                                    <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
                                      {item.content}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                      {item.published_at && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {new Date(item.published_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {item.source_url && (
                                        <a 
                                          href={item.source_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline flex items-center gap-1"
                                        >
                                          View Source
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
