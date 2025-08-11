import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  MessageSquare, 
  MoreVertical, 
  Trash2, 
  Edit3,
  Check,
  X,
  PanelLeft,
} from "lucide-react";
import { ChatSession } from "@/types/chatSession";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ChatSidebar = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  collapsed,
  onToggleCollapse,
}: ChatSidebarProps) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleRename = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle);
  };

  const saveRename = () => {
    if (editingSessionId && editTitle.trim()) {
      onRenameSession(editingSessionId, editTitle.trim());
    }
    setEditingSessionId(null);
    setEditTitle("");
  };

  const cancelRename = () => {
    setEditingSessionId(null);
    setEditTitle("");
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (sessionDate.getTime() === today.getTime()) {
      return "Today";
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (sessionDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }
    
    return date.toLocaleDateString();
  };

  if (collapsed) {
    return (
      <div className="w-14 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col">
        <div className="p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="w-full"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewSession}
            className="w-full"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.slice(0, 10).map((session) => (
              <Button
                key={session.id}
                variant={activeSessionId === session.id ? "secondary" : "ghost"}
                size="icon"
                onClick={() => onSessionSelect(session.id)}
                className="w-full"
                title={session.title}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Chat Sessions</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-6 w-6"
          >
            <PanelLeft className="h-3 w-3" />
          </Button>
        </div>
        <Button onClick={onNewSession} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No chat sessions yet.
              <br />
              Start a new conversation!
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => {
                console.log('Rendering session:', session.id, 'editingSessionId:', editingSessionId);
                return (
                  <div
                    key={session.id}
                    className={`group relative rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 border-2 border-yellow-400 ${
                      activeSessionId === session.id ? "bg-muted" : ""
                    }`}
                    onClick={() => onSessionSelect(session.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename();
                                if (e.key === "Escape") cancelRename();
                              }}
                              className="h-6 text-xs"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={saveRename}
                              className="h-6 w-6"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={cancelRename}
                              className="h-6 w-6"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-sm truncate">{session.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(session.updatedAt)} • {session.messages.length} messages
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* DEBUG: Show session info and button state */}
                      <div className="text-xs text-green-500 mr-2 bg-black p-1">
                        Session: {session.id.slice(0, 8)}<br/>
                        Editing: {editingSessionId ? editingSessionId.slice(0, 8) : 'none'}<br/>
                        Show buttons: {editingSessionId !== session.id ? 'YES' : 'NO'}
                      </div>

                      {/* Action buttons - EXTREME DEBUG VERSION */}
                      {editingSessionId !== session.id && (
                        <div 
                          className="fixed top-0 right-0 z-[9999] bg-red-600 text-white p-4 border-8 border-yellow-300"
                          style={{ minWidth: '200px', minHeight: '100px' }}
                        >
                          <div className="text-xl font-bold mb-2">BUTTONS SHOULD BE HERE!</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('FIXED POSITION Delete button clicked for session:', session.id);
                              if (window.confirm('Delete this chat session?')) {
                                onDeleteSession(session.id);
                              }
                            }}
                            className="block w-full h-12 bg-red-800 text-white text-lg font-bold mb-2"
                          >
                            DELETE SESSION
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('FIXED POSITION Rename button clicked for session:', session.id);
                              handleRename(session.id, session.title);
                            }}
                            className="block w-full h-12 bg-blue-800 text-white text-lg font-bold"
                          >
                            RENAME SESSION
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};