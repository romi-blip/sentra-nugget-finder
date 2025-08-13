import React, { useState } from "react";
import { Trash2, Calendar, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ChatSession } from "@/types/chatSession";

interface ChatCleanupProps {
  sessions: ChatSession[];
  onBulkDelete: (sessionIds: string[]) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatCleanup({ sessions, onBulkDelete, open, onOpenChange }: ChatCleanupProps) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const handleSelectAll = () => {
    if (selectedSessions.length === sessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(sessions.map(s => s.id));
    }
  };

  const handleSessionToggle = (sessionId: string) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.length === 0) return;
    
    setDeleting(true);
    try {
      await onBulkDelete(selectedSessions);
      setSelectedSessions([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error during bulk delete:", error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Group sessions by age for easier management
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groupedSessions = {
    recent: sessions.filter(s => s.updatedAt > oneWeekAgo),
    lastWeek: sessions.filter(s => s.updatedAt <= oneWeekAgo && s.updatedAt > oneMonthAgo),
    older: sessions.filter(s => s.updatedAt <= oneMonthAgo),
  };

  const SessionGroup = ({ title, sessions: groupSessions, badge }: { title: string; sessions: ChatSession[]; badge?: string }) => {
    if (groupSessions.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm text-muted-foreground">{title}</h4>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <div className="space-y-1">
          {groupSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 p-2 rounded border hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                checked={selectedSessions.includes(session.id)}
                onCheckedChange={() => handleSessionToggle(session.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{session.title}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3" />
                    <span>{session.messages.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(session.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Manage Chat Sessions
          </DialogTitle>
          <DialogDescription>
            Select conversations to delete. You have {sessions.length} total conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {sessions.length > 10 && (
            <Alert>
              <AlertDescription>
                You have {sessions.length} conversations. Consider cleaning up older ones to improve performance.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {selectedSessions.length === sessions.length ? "Deselect All" : "Select All"}
            </Button>
            {selectedSessions.length > 0 && (
              <Badge variant="secondary">
                {selectedSessions.length} selected
              </Badge>
            )}
          </div>

          <div className="space-y-6">
            <SessionGroup 
              title="Recent (Last 7 days)" 
              sessions={groupedSessions.recent}
              badge={`${groupedSessions.recent.length}`}
            />
            <SessionGroup 
              title="Last Week to Month" 
              sessions={groupedSessions.lastWeek}
              badge={`${groupedSessions.lastWeek.length}`}
            />
            <SessionGroup 
              title="Older than 1 Month" 
              sessions={groupedSessions.older}
              badge={`${groupedSessions.older.length}`}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={selectedSessions.length === 0 || deleting}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : `Delete ${selectedSessions.length} conversations`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}