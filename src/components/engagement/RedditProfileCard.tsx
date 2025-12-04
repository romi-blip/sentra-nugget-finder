import { useState } from 'react';
import { RefreshCw, Trash2, ExternalLink, ChevronDown, ChevronUp, Award, MessageSquare, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RedditProfile } from '@/hooks/useRedditProfiles';
import { formatDistanceToNow } from 'date-fns';

interface RedditProfileCardProps {
  profile: RedditProfile;
  onSync: () => void;
  onToggleActive: (is_active: boolean) => void;
  onRemove: () => void;
  isSyncing: boolean;
}

export function RedditProfileCard({ 
  profile, 
  onSync, 
  onToggleActive, 
  onRemove,
  isSyncing 
}: RedditProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatKarma = (karma: number) => {
    if (karma >= 1000000) return `${(karma / 1000000).toFixed(1)}M`;
    if (karma >= 1000) return `${(karma / 1000).toFixed(1)}K`;
    return karma.toString();
  };

  const accountAge = profile.account_created_at 
    ? formatDistanceToNow(new Date(profile.account_created_at), { addSuffix: false })
    : 'Unknown';

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border rounded-lg p-3 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.reddit_username} />
              <AvatarFallback className="bg-primary/10">
                {profile.reddit_username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <a 
                  href={profile.profile_url || `https://reddit.com/u/${profile.reddit_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:text-primary flex items-center gap-1"
                >
                  u/{profile.reddit_username}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {profile.is_premium && (
                  <Badge variant="secondary" className="text-xs">Premium</Badge>
                )}
                {profile.is_verified && (
                  <Badge variant="outline" className="text-xs">Verified</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  {formatKarma(profile.total_karma)} karma
                </span>
                <span>{accountAge} old</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={profile.is_active}
              onCheckedChange={onToggleActive}
              className="scale-75"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onSync}
              disabled={isSyncing}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-3 pt-3 border-t space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>Post Karma</span>
                </div>
                <div className="font-semibold">{formatKarma(profile.link_karma)}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span>Comment Karma</span>
                </div>
                <div className="font-semibold">{formatKarma(profile.comment_karma)}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Award className="h-3 w-3" />
                  <span>Total</span>
                </div>
                <div className="font-semibold">{formatKarma(profile.total_karma)}</div>
              </div>
            </div>

            {profile.description && (
              <p className="text-xs text-muted-foreground">{profile.description}</p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Last synced: {profile.last_synced_at 
                  ? formatDistanceToNow(new Date(profile.last_synced_at), { addSuffix: true })
                  : 'Never'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-destructive hover:text-destructive h-7"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
