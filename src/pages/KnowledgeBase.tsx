import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

interface KBItem {
  id: string;
  name: string;
  type: "file" | "drive";
  sourceUrl?: string;
  size?: number;
  status: "pending" | "processing" | "ready" | "error";
  createdAt: string;
}

const STORAGE_KEY = "kbItems";

const saveItems = (items: KBItem[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
const loadItems = (): KBItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KBItem[]) : [];
  } catch {
    return [];
  }
};

const KnowledgeBase = () => {
  const [items, setItems] = useState<KBItem[]>(loadItems());
  const [driveUrl, setDriveUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => saveItems(items), [items]);

  const webhookUrl = useMemo(() => localStorage.getItem("n8nWebhookUrl") || "", []);

  const triggerWebhook = async (payload: FormData | object) => {
    const url = localStorage.getItem("n8nWebhookUrl") || "";
    if (!url) {
      toast({ title: "Webhook missing", description: "Open Settings and add your n8n webhook URL.", variant: "destructive" });
      return { ok: false };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        ...(payload instanceof FormData
          ? { body: payload }
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
        mode: "no-cors",
      });
      // no-cors means we can't read response; assume sent
      return { ok: true };
    } catch (e) {
      console.error(e);
      toast({ title: "Request failed", description: "Could not reach n8n webhook", variant: "destructive" });
      return { ok: false };
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const toAdd: KBItem[] = [];
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${file.name}`;
      toAdd.push({ id, name: file.name, type: "file", size: file.size, status: "processing", createdAt: new Date().toISOString() });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", "upload");
      triggerWebhook(fd);
    }

    setItems((prev) => [...toAdd, ...prev]);
    toast({ title: "Uploading", description: `${files.length} file(s) sent to n8n for processing` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addDriveFolder = async () => {
    if (!driveUrl) return;
    const id = `${Date.now()}-drive`;
    const item: KBItem = { id, name: "Google Drive Folder", type: "drive", sourceUrl: driveUrl, status: "processing", createdAt: new Date().toISOString() };
    setItems((prev) => [item, ...prev]);

    await triggerWebhook({ source: "google-drive", url: driveUrl });
    toast({ title: "Connected", description: "Drive folder sent to n8n for indexing" });
    setDriveUrl("");
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const markReady = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "ready" } : i)));

  return (
    <main className="min-h-screen">
      <SEO title="Sentra Knowledge Base Manager" description="Upload files or connect Google Drive and index content to your Supabase vector DB via n8n." canonicalPath="/kb" />

      <section className="bg-hero">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Knowledge Base</h1>
          <p className="text-muted-foreground max-w-2xl">Upload PDFs, docs and decks or connect a Google Drive folder. We'll send them to your n8n webhook for processing into your Supabase vector database.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 grid gap-6 md:grid-cols-2 -mt-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>Supported: PDF, DOCX, PPTX, TXT, Markdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input ref={fileInputRef} type="file" multiple onChange={(e) => onUpload(e.target.files)} />
            <div className="text-xs text-muted-foreground">Files are sent directly to your n8n webhook.</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Connect Google Drive Folder</CardTitle>
            <CardDescription>Paste a shared link with viewer access</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="drive">Folder URL</Label>
              <Input id="drive" placeholder="https://drive.google.com/drive/folders/..." value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
            </div>
            <Button variant="hero" onClick={addDriveFolder}>Add</Button>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Content Sources</CardTitle>
            <CardDescription>Manage your indexed files and folders</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No items yet. Upload files or connect a Drive folder.</TableCell>
                  </TableRow>
                ) : (
                  items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-[280px] truncate" title={i.name}>{i.name}</TableCell>
                      <TableCell className="capitalize">{i.type}</TableCell>
                      <TableCell className="capitalize">{i.status}</TableCell>
                      <TableCell>{new Date(i.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="secondary" onClick={() => markReady(i.id)}>Mark ready</Button>
                        <Button size="sm" variant="destructive" onClick={() => removeItem(i.id)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default KnowledgeBase;
