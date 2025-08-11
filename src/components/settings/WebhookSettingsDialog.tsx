import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export const WebhookSettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("n8nWebhookUrl");
    if (stored) setUrl(stored);
  }, [open]);

  const save = () => {
    try {
      localStorage.setItem("n8nWebhookUrl", url.trim());
      toast({ title: "Saved", description: "n8n webhook URL saved" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save URL", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>n8n Webhook</DialogTitle>
          <DialogDescription>
            Enter the n8n webhook URL that ingests uploaded files or Google Drive
            links and pushes them into your Supabase vector database.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="webhook">Webhook URL</Label>
          <Input
            id="webhook"
            placeholder="https://n8n.yourdomain.com/webhook/ingest"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            We store this locally in your browser. You can change it anytime.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WebhookSettingsDialog;
