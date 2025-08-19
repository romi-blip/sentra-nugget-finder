import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Upload, FolderOpen, Check, X, Loader2 } from "lucide-react";
import { useGlobalWebhooks } from "@/hooks/useGlobalWebhooks";
import type { Database } from '@/integrations/supabase/types';

type GlobalWebhook = Database['public']['Tables']['global_webhooks']['Row'];

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
  const { webhooks, isLoading, saveWebhook, testWebhook } = useGlobalWebhooks();
  const [editingWebhooks, setEditingWebhooks] = useState<Record<string, string>>({});
  const [testingWebhooks, setTestingWebhooks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (webhooks.length > 0) {
      const initialUrls: Record<string, string> = {};
      webhooks.forEach(webhook => {
        initialUrls[webhook.id] = webhook.url;
      });
      setEditingWebhooks(initialUrls);
    }
  }, [webhooks]);

  const handleUrlChange = (webhookId: string, url: string) => {
    setEditingWebhooks(prev => ({ ...prev, [webhookId]: url }));
  };

  const handleSave = async (webhookId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId);
    if (!webhook) return;

    await saveWebhook({
      id: webhookId,
      url: editingWebhooks[webhookId] || webhook.url,
    });
  };

  const handleTest = async (webhookId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId);
    if (!webhook) return;

    const updatedWebhook = {
      ...webhook,
      url: editingWebhooks[webhook.id] || webhook.url,
    };

    setTestingWebhooks(prev => new Set([...prev, webhookId]));
    
    try {
      await testWebhook(updatedWebhook);
    } finally {
      setTestingWebhooks(prev => {
        const next = new Set(prev);
        next.delete(webhookId);
        return next;
      });
    }
  };

  const getStatusBadge = (webhook: GlobalWebhook) => {
    const url = editingWebhooks[webhook.id] ?? webhook.url;
    if (!url) return <Badge variant="secondary">Not Configured</Badge>;
    
    if (webhook.last_tested) {
      const isRecent = Date.now() - new Date(webhook.last_tested).getTime() < 24 * 60 * 60 * 1000;
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
                
                {webhook.last_tested && (
                  <p className="text-xs text-muted-foreground">
                    Last tested: {new Date(webhook.last_tested).toLocaleString()}
                  </p>
                )}
                
                {webhook.last_used && (
                  <p className="text-xs text-muted-foreground">
                    Last used: {new Date(webhook.last_used).toLocaleString()}
                  </p>
                )}
                
                <Button
                  onClick={() => handleSave(webhook.id)}
                  disabled={editingWebhooks[webhook.id] === webhook.url}
                  size="sm"
                >
                  Save Webhook
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Webhooks are stored centrally and accessible by all users when configured.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WebhookSettingsDialog;
