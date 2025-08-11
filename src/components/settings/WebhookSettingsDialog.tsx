import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Upload, FolderOpen, Check, X, Loader2 } from "lucide-react";
import { useWebhooks } from "@/hooks/useWebhooks";
import { WebhookConfig, WebhookType } from "@/types/webhook";
import { toast } from "@/hooks/use-toast";

const WEBHOOK_ICONS = {
  chat: MessageSquare,
  file_upload: Upload,
  google_drive: FolderOpen,
};

const WEBHOOK_DESCRIPTIONS = {
  chat: "Handles AI chat responses and knowledge base queries",
  file_upload: "Processes uploaded files into your vector database", 
  google_drive: "Syncs and processes Google Drive content",
};

export const WebhookSettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { webhooks, isLoading, updateWebhook, testWebhook, saveWebhooks } = useWebhooks();
  const [editingWebhooks, setEditingWebhooks] = useState<Record<string, string>>({});
  const [testingWebhooks, setTestingWebhooks] = useState<Set<string>>(new Set());

  const handleUrlChange = (webhookId: string, url: string) => {
    setEditingWebhooks(prev => ({ ...prev, [webhookId]: url }));
  };

  const handleSave = () => {
    const updatedWebhooks = webhooks.map(webhook => ({
      ...webhook,
      url: editingWebhooks[webhook.id] ?? webhook.url,
    }));
    
    saveWebhooks(updatedWebhooks);
    setEditingWebhooks({});
    toast({ title: "Saved", description: "Webhook configuration saved successfully" });
    onOpenChange(false);
  };

  const handleTest = async (webhookId: string) => {
    setTestingWebhooks(prev => new Set([...prev, webhookId]));
    await testWebhook(webhookId);
    setTestingWebhooks(prev => {
      const newSet = new Set(prev);
      newSet.delete(webhookId);
      return newSet;
    });
  };

  const getStatusBadge = (webhook: WebhookConfig) => {
    const url = editingWebhooks[webhook.id] ?? webhook.url;
    if (!url) return <Badge variant="secondary">Not Configured</Badge>;
    
    if (webhook.lastTested) {
      const isRecent = Date.now() - webhook.lastTested.getTime() < 24 * 60 * 60 * 1000;
      return (
        <Badge variant={isRecent ? "default" : "secondary"} className="gap-1">
          <Check className="h-3 w-3" />
          Tested
        </Badge>
      );
    }
    
    return <Badge variant="outline">Ready to Test</Badge>;
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>N8N Webhook Configuration</DialogTitle>
          <DialogDescription>
            Configure your N8N webhooks for different integrations. Each webhook serves a specific purpose.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {webhooks.map((webhook) => {
              const Icon = WEBHOOK_ICONS[webhook.type];
              return (
                <TabsTrigger key={webhook.id} value={webhook.type} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {webhook.name}
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {webhooks.map((webhook) => (
            <TabsContent key={webhook.id} value={webhook.type} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{webhook.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {WEBHOOK_DESCRIPTIONS[webhook.type]}
                  </p>
                </div>
                {getStatusBadge(webhook)}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor={`webhook-${webhook.id}`}>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    id={`webhook-${webhook.id}`}
                    placeholder={`https://n8n.yourdomain.com/webhook/${webhook.type.replace('_', '-')}`}
                    value={editingWebhooks[webhook.id] ?? webhook.url}
                    onChange={(e) => handleUrlChange(webhook.id, e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(webhook.id)}
                    disabled={!editingWebhooks[webhook.id] && !webhook.url || testingWebhooks.has(webhook.id)}
                  >
                    {testingWebhooks.has(webhook.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>
                </div>
                
                {webhook.lastTested && (
                  <p className="text-xs text-muted-foreground">
                    Last tested: {webhook.lastTested.toLocaleString()}
                  </p>
                )}
                
                {webhook.lastUsed && (
                  <p className="text-xs text-muted-foreground">
                    Last used: {webhook.lastUsed.toLocaleString()}
                  </p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Webhooks are stored securely in your browser and can be changed anytime.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={handleSave}>
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WebhookSettingsDialog;
