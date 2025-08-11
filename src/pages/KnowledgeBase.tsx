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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

// Helper: validate if a string looks like a valid Google Drive ID
const isValidDriveId = (id?: string | null): boolean => {
  if (!id) return false;
  const cleanId = id.trim();
  // Google Drive IDs are typically 25+ alphanumeric characters with some special chars
  // They should not be just numbers like "1903"
  return cleanId.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(cleanId) && !/^\d+$/.test(cleanId);
};

// Helper: validate a Google Drive/Docs URL
const isValidGoogleUrl = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isGoogleHost = host.endsWith("google.com");
    if (!isGoogleHost) return false;

    if (host === "drive.google.com") {
      return (
        u.pathname.includes("/drive/folders/") ||
        u.pathname.includes("/file/d/") ||
        u.pathname.includes("/open") ||
        u.pathname.includes("/uc") ||
        u.searchParams.has("id")
      );
    }
    if (host === "docs.google.com") {
      return (
        u.pathname.includes("/document/d/") ||
        u.pathname.includes("/spreadsheets/d/") ||
        u.pathname.includes("/presentation/d/") ||
        u.pathname.includes("/forms/d/") ||
        u.pathname.includes("/drawings/d/")
      );
    }
    return true;
  } catch {
    return false;
  }
};

// Helper: correct malformed Google URLs
const correctGoogleUrl = (url: string, drive_id?: string | null, mime_type?: string | null): string => {
  try {
    const u = new URL(url);
    const mt = (mime_type || "").toLowerCase();
    
    // Extract ID from various URL formats
    let extractedId = drive_id;
    if (!extractedId) {
      const pathMatch = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const idParam = u.searchParams.get("id");
      extractedId = pathMatch?.[1] || idParam;
    }
    
    if (!isValidDriveId(extractedId)) {
      console.warn("KnowledgeBase: Invalid or missing drive ID in URL:", url);
      return url; // Return original if we can't fix it
    }
    
    // Build correct URL based on mime type
    if (mt.includes("vnd.google-apps.folder")) {
      return `https://drive.google.com/drive/folders/${extractedId}`;
    }
    if (mt.includes("vnd.google-apps.document")) {
      return `https://docs.google.com/document/d/${extractedId}/edit`;
    }
    if (mt.includes("vnd.google-apps.spreadsheet")) {
      return `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    }
    if (mt.includes("vnd.google-apps.presentation")) {
      return `https://docs.google.com/presentation/d/${extractedId}/edit`;
    }
    if (mt.includes("vnd.google-apps.form")) {
      return `https://docs.google.com/forms/d/${extractedId}/edit`;
    }
    if (mt.includes("vnd.google-apps.drawing")) {
      return `https://docs.google.com/drawings/d/${extractedId}/edit`;
    }
    
    // For PDFs and other files, use Drive file view
    return `https://drive.google.com/file/d/${extractedId}/view`;
  } catch {
    console.warn("KnowledgeBase: Could not parse URL for correction:", url);
    return url;
  }
};

// Helper: Build a canonical open URL from drive_id + mime_type, with robust fallbacks
const buildDriveOpenUrl = (
  drive_url?: string | null,
  drive_id?: string | null,
  mime_type?: string | null
): string | undefined => {
  const url = (drive_url || "").trim();
  const id = (drive_id || "").trim();
  const mt = (mime_type || "").toLowerCase();
  
  console.log("KnowledgeBase: Building URL for:", { drive_url: url, drive_id: id, mime_type: mt });
  
  // If we have a valid Google URL, try to correct it if needed
  if (url && isValidGoogleUrl(url)) {
    const correctedUrl = correctGoogleUrl(url, id, mt);
    console.log("KnowledgeBase: Using corrected URL:", correctedUrl);
    return correctedUrl;
  }
  
  // Validate drive ID
  if (!isValidDriveId(id)) {
    console.warn("KnowledgeBase: Invalid drive_id provided:", id);
    if (url) {
      console.warn("KnowledgeBase: drive_url is also invalid:", url);
    }
    return undefined;
  }
  
  // Build URL from drive_id and mime_type
  let builtUrl: string;
  if (mt.includes("vnd.google-apps.folder")) {
    builtUrl = `https://drive.google.com/drive/folders/${id}`;
  } else if (mt.includes("vnd.google-apps.document")) {
    builtUrl = `https://docs.google.com/document/d/${id}/edit`;
  } else if (mt.includes("vnd.google-apps.spreadsheet")) {
    builtUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  } else if (mt.includes("vnd.google-apps.presentation")) {
    builtUrl = `https://docs.google.com/presentation/d/${id}/edit`;
  } else if (mt.includes("vnd.google-apps.form")) {
    builtUrl = `https://docs.google.com/forms/d/${id}/edit`;
  } else if (mt.includes("vnd.google-apps.drawing")) {
    builtUrl = `https://docs.google.com/drawings/d/${id}/edit`;
  } else {
    // Default to Drive file view for PDFs, images, etc.
    builtUrl = `https://drive.google.com/file/d/${id}/view`;
  }
  
  console.log("KnowledgeBase: Built URL from drive_id:", builtUrl);
  return builtUrl;
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
        .select("id, file_name, drive_url, drive_id, mime_type, file_updated_date, created_at, updated_at, external, version")
        .order("file_updated_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Map assets into displayable KB items
  const assetItems: KBItem[] = useMemo(() => {
    return (assets || []).map((a: any) => {
      const url = buildDriveOpenUrl(a.drive_url, a.drive_id, a.mime_type);

      return {
        id: `asset-${a.id}`,
        name: a.file_name,
        type: "asset",
        sourceUrl: url,
        mimeType: a.mime_type || undefined,
        status: "ready",
        createdAt: a.file_updated_date || a.updated_at || a.created_at || new Date().toISOString(),
      } as KBItem;
    });
  }, [assets]);

  // Combine Supabase assets with local items for display only
  const displayItems = useMemo(() => [...assetItems, ...items], [assetItems, items]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE)), [displayItems.length]);
  const visiblePages = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    const delta = 1; // number of pages around current
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    pages.push(1);
    if (left > 2) pages.push("ellipsis");
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < totalPages - 1) pages.push("ellipsis");
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  }, [page, totalPages]);
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
    const iconSize = "h-5 w-5";
    
    if (item.type === "drive") {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-folder/10">
          <Folder className={`${iconSize} file-icon-folder`} aria-hidden />
        </div>
      );
    }
    
    const mt = (item.mimeType || "").toLowerCase();
    
    if (mt.startsWith("image/") || mt.startsWith("video/") || mt.startsWith("audio/")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-media/10">
          {mt.startsWith("image/") && <FileImage className={`${iconSize} file-icon-media`} aria-hidden />}
          {mt.startsWith("video/") && <FileVideo className={`${iconSize} file-icon-media`} aria-hidden />}
          {mt.startsWith("audio/") && <FileAudio className={`${iconSize} file-icon-media`} aria-hidden />}
        </div>
      );
    }
    
    if (mt.includes("folder")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-folder/10">
          <Folder className={`${iconSize} file-icon-folder`} aria-hidden />
        </div>
      );
    }
    
    if (mt.includes("pdf") || mt.includes("document") || mt.includes("text")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-document/10">
          <FileText className={`${iconSize} file-icon-document`} aria-hidden />
        </div>
      );
    }
    
    if (mt.includes("zip") || mt.includes("compressed") || mt.includes("tar") || mt.includes("archive")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-archive/10">
          <FileArchive className={`${iconSize} file-icon-archive`} aria-hidden />
        </div>
      );
    }
    
    if (mt.includes("spreadsheet") || mt.includes("excel") || mt.includes("csv")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-spreadsheet/10">
          <FileSpreadsheet className={`${iconSize} file-icon-spreadsheet`} aria-hidden />
        </div>
      );
    }
    
    if (mt.includes("presentation") || mt.includes("powerpoint")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-presentation/10">
          <FileText className={`${iconSize} file-icon-presentation`} aria-hidden />
        </div>
      );
    }
    
    if (mt.includes("json") || mt.includes("xml") || mt.includes("javascript") || mt.includes("typescript") || mt.includes("html") || mt.includes("css") || mt.includes("code")) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-file-code/10">
          <FileCode className={`${iconSize} file-icon-code`} aria-hidden />
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/20">
        <FileIcon className={`${iconSize} file-icon-default`} aria-hidden />
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Ready</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "file":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">File</Badge>;
      case "drive":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Drive</Badge>;
      case "asset":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Asset</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <main className="min-h-screen">
      <SEO title="Sentra Knowledge Base Manager" description="Upload files or connect Google Drive and index content to your Supabase vector DB via n8n." canonicalPath="/kb" />

      <section className="bg-gradient-to-r from-primary/10 via-brand-2/5 to-primary/10 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-brand-2 bg-clip-text text-transparent">
              Knowledge Base
            </h1>
            <p className="text-muted-foreground max-w-3xl mx-auto text-lg">
              Upload PDFs, docs and decks or connect a Google Drive folder. We'll send them to your n8n webhook for processing into your Supabase vector database.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 -mt-12 mb-16">
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="glass-card hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Upload Files</CardTitle>
                  <CardDescription>Supported: PDF, DOCX, PPTX, TXT, Markdown</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Input 
                  ref={fileInputRef} 
                  type="file" 
                  multiple 
                  onChange={(e) => onUpload(e.target.files)}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Files are sent directly to your n8n webhook for processing
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-2/10">
                  <Folder className="h-5 w-5 text-brand-2" />
                </div>
                <div>
                  <CardTitle className="text-xl">Connect Google Drive</CardTitle>
                  <CardDescription>Paste a shared link with viewer access</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="drive" className="text-sm font-medium">Folder URL</Label>
                  <div className="flex gap-3">
                    <Input 
                      id="drive" 
                      placeholder="https://drive.google.com/drive/folders/..." 
                      value={driveUrl} 
                      onChange={(e) => setDriveUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      variant="default" 
                      onClick={addDriveFolder}
                      disabled={!driveUrl.trim()}
                      className="shrink-0"
                    >
                      Connect
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Folder contents will be indexed automatically
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16">
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-card to-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Content Sources</CardTitle>
                <CardDescription className="mt-1">Manage your indexed files and folders</CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {displayItems.length} {displayItems.length === 1 ? 'item' : 'items'} total
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {assetsLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b bg-muted/30">
                    <TableHead className="py-4 font-semibold">File</TableHead>
                    <TableHead className="py-4 font-semibold">Type</TableHead>
                    <TableHead className="py-4 font-semibold">Status</TableHead>
                    <TableHead className="py-4 font-semibold">Date Added</TableHead>
                    <TableHead className="py-4 font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <FileIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground">No content sources yet</p>
                            <p className="text-sm text-muted-foreground">Upload files or connect a Drive folder to get started</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((i) => (
                      <TableRow key={i.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3 max-w-[300px]">
                            {renderIcon(i)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate" title={i.name}>{i.name}</p>
                              {i.mimeType && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {i.mimeType.split('/').pop()?.toUpperCase()}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {getTypeBadge(i.type)}
                        </TableCell>
                        <TableCell className="py-4">
                          {getStatusBadge(i.status)}
                        </TableCell>
                        <TableCell className="py-4 text-sm text-muted-foreground">
                          {new Date(i.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {i.type === "asset" ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  onClick={() => indexAsset(i)}
                                  className="hover:bg-primary hover:text-primary-foreground transition-colors"
                                >
                                  Index
                                </Button>
                                {i.sourceUrl && isValidGoogleUrl(i.sourceUrl) ? (
                                  <Button size="sm" variant="outline" asChild className="hover:bg-brand-2 hover:text-white hover:border-brand-2 transition-colors">
                                    <a href={i.sourceUrl} target="_blank" rel="noreferrer">Open</a>
                                  </Button>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  onClick={() => markReady(i.id)}
                                  className="hover:bg-green-600 hover:text-white transition-colors"
                                >
                                  Mark Ready
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => removeItem(i.id)}
                                  className="hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                                >
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
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
                  {visiblePages.map((pg, idx) =>
                    pg === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={pg}>
                        <PaginationLink
                          href="#"
                          isActive={pg === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(pg as number);
                          }}
                        >
                          {pg}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
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
