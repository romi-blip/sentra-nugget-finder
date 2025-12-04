import { useState } from 'react';
import { ExternalLink, MessageSquare, FileText, ArrowUp, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRedditProfileActivity, RedditProfileActivity } from '@/hooks/useRedditProfileActivity';
import { useRedditProfiles } from '@/hooks/useRedditProfiles';
import { formatDistanceToNow } from 'date-fns';

export function RedditProfileActivityFeed() {
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [activityType, setActivityType] = useState<string>('all');
  
  const { profiles } = useRedditProfiles();
  const { activity, isLoading } = useRedditProfileActivity({
    profileId: selectedProfile === 'all' ? undefined : selectedProfile,
    activityType: activityType === 'all' ? undefined : activityType as 'post' | 'comment',
    limit: 50,
  });

  const getProfileUsername = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile?.reddit_username || 'Unknown';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Profile Activity</CardTitle>
          <div className="flex gap-2">
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue placeholder="All profiles" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All profiles</SelectItem>
                {profiles.map(profile => (
                  <SelectItem key={profile.id} value={profile.id}>
                    u/{profile.reddit_username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="post">Posts</SelectItem>
                <SelectItem value="comment">Comments</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Loading activity...
          </div>
        ) : activity.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No activity found. Add profiles and sync to see activity.
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activity.map((item) => (
              <ActivityItem 
                key={item.id} 
                item={item} 
                username={getProfileUsername(item.profile_id)}
                showUsername={selectedProfile === 'all'}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityItemProps {
  item: RedditProfileActivity;
  username: string;
  showUsername: boolean;
}

function ActivityItem({ item, username, showUsername }: ActivityItemProps) {
  const isPost = item.activity_type === 'post';
  
  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded ${isPost ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
          {isPost ? (
            <FileText className="h-4 w-4 text-blue-500" />
          ) : (
            <MessageSquare className="h-4 w-4 text-green-500" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showUsername && (
              <span className="text-xs font-medium text-primary">u/{username}</span>
            )}
            <Badge variant="outline" className="text-xs">
              r/{item.subreddit || 'unknown'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {item.posted_at 
                ? formatDistanceToNow(new Date(item.posted_at), { addSuffix: true })
                : 'Unknown time'}
            </span>
          </div>
          
          {item.title && (
            <h4 className="text-sm font-medium mt-1 line-clamp-1">{item.title}</h4>
          )}
          
          {item.content && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {item.content}
            </p>
          )}
          
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUp className="h-3 w-3" />
              {item.score}
            </span>
            {isPost && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                {item.num_comments}
              </span>
            )}
            {item.permalink && (
              <a 
                href={item.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
