import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { File as FileIcon, FileText, FileSpreadsheet, FileImage, FileCode, FileAudio, FileVideo, FileArchive, Folder } from "lucide-react";
interface KBItem {
  id: string;
  name: string;
  type: "file" | "drive" | "asset";
  sourceUrl?: string;
  size?: number;
  mimeType?: string;
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

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const webhookUrl = useMemo(() => localStorage.getItem("n8nWebhookUrl") || "", []);
  // Fetch Sales Enablement Assets from Supabase
  const { data: assets, isLoading: assetsLoading, error: assetsError } = useQuery({
    queryKey: ["sales_enablement_assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_enablement_assets")
        .select("id, file_name, drive_url, mime_type, file_updated_date, created_at, updated_at, external, version")
        .order("file_updated_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Map assets into displayable KB items
  const assetItems: KBItem[] = useMemo(() => {
    return (assets || []).map((a: any) => ({
      id: `asset-${a.id}`,
      name: a.file_name,
      type: "asset",
      sourceUrl: a.drive_url,
      mimeType: a.mime_type || undefined,
      status: "ready",
      createdAt: a.file_updated_date || a.updated_at || a.created_at || new Date().toISOString(),
    }));
  }, [assets]);

  // Combine Supabase assets with local items for display only
  const displayItems = useMemo(() => [...assetItems, ...items], [assetItems, items]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE)), [displayItems.length]);
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return displayItems.slice(start, start + PAGE_SIZE);
  }, [displayItems, page]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [displayItems.length, totalPages]);
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
      toAdd.push({
        id,
        name: file.name,
        type: "file",
        size: file.size,
        mimeType: file.type || undefined,
        status: "processing",
        createdAt: new Date().toISOString(),
      });

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

  const indexAsset = async (asset: KBItem) => {
    await triggerWebhook({
      source: "sales_enablement_asset",
      url: asset.sourceUrl,
      name: asset.name,
    });
    toast({ title: "Indexing triggered", description: `${asset.name} sent to n8n for indexing` });
  };

  const renderIcon = (item: KBItem) => {
    if (item.type === "drive") return <Folder className="h-4 w-4 text-muted-foreground" aria-hidden />;
    const mt = (item.mimeType || "").toLowerCase();
    if (mt.startsWith("image/")) return <FileImage className="h-4 w-4 text-muted-foreground" aria-hidden />;
    if (mt.startsWith("video/")) return <FileVideo className="h-4 w-4 text-muted-foreground" aria-hidden />;
    if (mt.startsWith("audio/")) return <FileAudio className="h-4 w-4 text-muted-foreground" aria-hidden />;
    if (mt.includes("pdf")) return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />;
    if (mt.includes("zip") || mt.includes("compressed") || mt.includes("tar")) return <FileArchive className="h-4 w-4 text-muted-foreground" aria-hidden />;
    if (mt.includes("spreadsheet") || mt.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden />;
    if (mt.includes("json") || mt.includes("xml") || mt.includes("javascript") || mt.includes("typescript") || mt.includes("html") || mt.includes("css")) return <FileCode className="h-4 w-4 text-muted-foreground" aria-hidden />;
    return <FileIcon className="h-4 w-4 text-muted-foreground" aria-hidden />;
  };

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
                {displayItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No items yet. Upload files or connect a Drive folder.</TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[280px]">
                          {renderIcon(i)}
                          <span className="truncate" title={i.name}>{i.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{i.type}</TableCell>
                      <TableCell className="capitalize">{i.status}</TableCell>
                      <TableCell>{new Date(i.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {i.type === "asset" ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => indexAsset(i)}>Index</Button>
                            {i.sourceUrl ? (
                              <Button size="sm" variant="outline" asChild>
                                <a href={i.sourceUrl} target="_blank" rel="noreferrer">Open</a>
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => markReady(i.id)}>Mark ready</Button>
                            <Button size="sm" variant="destructive" onClick={() => removeItem(i.id)}>Delete</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, idx) => {
                    const pg = idx + 1;
                    return (
                      <PaginationItem key={pg}>
                        <PaginationLink
                          href="#"
                          isActive={pg === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(pg);
                          }}
                        >
                          {pg}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages, p + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default KnowledgeBase;
