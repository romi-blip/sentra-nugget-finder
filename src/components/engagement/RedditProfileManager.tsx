import { useState } from 'react';
import { Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRedditProfiles } from '@/hooks/useRedditProfiles';
import { RedditProfileCard } from './RedditProfileCard';

export function RedditProfileManager() {
  const [username, setUsername] = useState('');
  const { profiles, isLoading, addProfile, syncProfile, toggleActive, removeProfile } = useRedditProfiles();

  const handleAddProfile = async () => {
    const cleanUsername = username.trim().replace(/^u\//, '');
    if (!cleanUsername) return;

    await addProfile.mutateAsync(cleanUsername);
    setUsername('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !addProfile.isPending) {
      handleAddProfile();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Reddit Profiles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter Reddit username (e.g., spez)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button 
            onClick={handleAddProfile} 
            disabled={!username.trim() || addProfile.isPending}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            {addProfile.isPending ? 'Adding...' : 'Add'}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No Reddit profiles connected. Add a username to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <RedditProfileCard
                key={profile.id}
                profile={profile}
                onSync={() => syncProfile.mutate(profile.id)}
                onToggleActive={(is_active) => toggleActive.mutate({ profile_id: profile.id, is_active })}
                onRemove={() => removeProfile.mutate(profile.id)}
                isSyncing={syncProfile.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
