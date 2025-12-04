import { useState } from 'react';
import { Plus, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useRedditProfiles } from '@/hooks/useRedditProfiles';
import { RedditProfileCard } from './RedditProfileCard';

export function RedditProfileManager() {
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'tracked' | 'managed'>('all');
  const { 
    profiles, 
    trackedProfiles, 
    managedProfiles, 
    isLoading, 
    addProfile, 
    syncProfile, 
    toggleActive, 
    removeProfile,
    generatePersona,
    updateProfileType
  } = useRedditProfiles();

  const handleAddProfile = async (profileType: 'tracked' | 'managed' = 'tracked') => {
    const cleanUsername = username.trim().replace(/^u\//, '');
    if (!cleanUsername) return;

    await addProfile.mutateAsync({ reddit_username: cleanUsername, profile_type: profileType });
    setUsername('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !addProfile.isPending) {
      handleAddProfile('tracked');
    }
  };

  const displayedProfiles = activeTab === 'all' 
    ? profiles 
    : activeTab === 'tracked' 
      ? trackedProfiles 
      : managedProfiles;

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
            onClick={() => handleAddProfile('tracked')} 
            disabled={!username.trim() || addProfile.isPending}
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-1" />
            Track
          </Button>
          <Button 
            onClick={() => handleAddProfile('managed')} 
            disabled={!username.trim() || addProfile.isPending}
            size="sm"
          >
            <Users className="h-4 w-4 mr-1" />
            Manage
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              All
              <Badge variant="secondary" className="ml-1 text-xs">{profiles.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="tracked" className="text-xs">
              Tracked
              <Badge variant="secondary" className="ml-1 text-xs">{trackedProfiles.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="managed" className="text-xs">
              Managed
              <Badge variant="secondary" className="ml-1 text-xs">{managedProfiles.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading profiles...</div>
            ) : displayedProfiles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {activeTab === 'all' 
                  ? "No Reddit profiles connected. Add a username to get started."
                  : activeTab === 'tracked'
                    ? "No tracked profiles. Add profiles you want to monitor."
                    : "No managed profiles. Managed profiles include AI-generated personas for reply generation."}
              </div>
            ) : (
              <div className="space-y-2">
                {displayedProfiles.map((profile) => (
                  <RedditProfileCard
                    key={profile.id}
                    profile={profile}
                    onSync={() => syncProfile.mutate(profile.id)}
                    onToggleActive={(is_active) => toggleActive.mutate({ profile_id: profile.id, is_active })}
                    onRemove={() => removeProfile.mutate(profile.id)}
                    onGeneratePersona={() => generatePersona.mutate(profile.id)}
                    onUpdateType={(type) => updateProfileType.mutate({ profile_id: profile.id, profile_type: type })}
                    isSyncing={syncProfile.isPending}
                    isGeneratingPersona={generatePersona.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
