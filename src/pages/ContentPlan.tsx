import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Search, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";
import { useContentPlan } from "@/hooks/useContentPlan";
import { ContentPlanTable } from "@/components/content/ContentPlanTable";
import { CreateContentItemDialog } from "@/components/content/CreateContentItemDialog";
import { ContentFieldMappingDialog } from "@/components/content/ContentFieldMappingDialog";
import { ContentDetailSheet } from "@/components/content/ContentDetailSheet";
import { ContentPlanItem, CreateContentItemData } from "@/services/contentService";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ContentPlan = () => {
  const { toast } = useToast();
  const {
    items,
    isLoading,
    createItem,
    createBulk,
    updateItem,
    deleteItem,
    deleteBulk,
    researchItem,
    isCreating,
    isImporting,
    isDeleting,
    isResearching,
    researchingId,
  } = useContentPlan();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentPlanItem | null>(null);
  const [viewItem, setViewItem] = useState<ContentPlanItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ContentPlanItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.strategic_purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.target_keywords?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: items.length,
    draft: items.filter(i => i.status === 'draft').length,
    researched: items.filter(i => i.status === 'researched').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    completed: items.filter(i => i.status === 'completed').length,
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast({ title: "CSV is empty", variant: "destructive" });
          return;
        }
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        setMappingDialogOpen(true);
      },
      error: (error) => {
        toast({ title: "Failed to parse CSV", description: error.message, variant: "destructive" });
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMappingComplete = (mappings: { csvColumn: string; systemField: string }[]) => {
    const mappedItems: CreateContentItemData[] = csvData.map(row => {
      const item: CreateContentItemData = {
        title: '',
        strategic_purpose: '',
      };

      mappings.forEach(mapping => {
        const value = row[mapping.csvColumn] || '';
        if (mapping.systemField === 'title') item.title = value;
        else if (mapping.systemField === 'strategic_purpose') item.strategic_purpose = value;
        else if (mapping.systemField === 'target_keywords') item.target_keywords = value;
        else if (mapping.systemField === 'outline') item.outline = value;
      });

      return item;
    }).filter(item => item.title && item.strategic_purpose);

    if (mappedItems.length === 0) {
      toast({ title: "No valid items to import", variant: "destructive" });
      return;
    }

    createBulk(mappedItems);
    setCsvHeaders([]);
    setCsvData([]);
  };

  const handleCreate = (data: CreateContentItemData) => {
    if (editItem) {
      updateItem({ id: editItem.id, updates: data });
      setEditItem(null);
    } else {
      createItem(data);
    }
  };

  const handleEdit = (item: ContentPlanItem) => {
    setEditItem(item);
    setCreateDialogOpen(true);
  };

  const handleDelete = (item: ContentPlanItem) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = () => {
    if (deleteConfirmItem) {
      deleteItem(deleteConfirmItem.id);
      setDeleteConfirmItem(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length > 0) {
      setBulkDeleteConfirm(true);
    }
  };

  const confirmBulkDelete = () => {
    deleteBulk(selectedIds);
    setSelectedIds([]);
    setBulkDeleteConfirm(false);
  };

  const handleCopy = async (item: ContentPlanItem) => {
    const textToCopy = item.content || item.outline || item.title;
    await navigator.clipboard.writeText(textToCopy);
    toast({ title: "Copied to clipboard" });
  };

  const handleExport = (item: ContentPlanItem) => {
    setViewItem(item);
  };

  const handleResearch = (item: ContentPlanItem) => {
    researchItem(item.id);
  };

  const handleCreateContent = (item: ContentPlanItem) => {
    toast({ title: "Create content feature", description: "Coming soon!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Content Plan | Sentra GTM Assistant" description="Plan, research, and create content." canonicalPath="/content" />
      
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Content Plan</h1>
            <p className="text-muted-foreground mt-1">Plan, research, and create content pieces.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importing..." : "Upload CSV"}
            </Button>
            <Button onClick={() => { setEditItem(null); setCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {selectedIds.length} selected
            </Button>
          )}
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({statusCounts.draft})</TabsTrigger>
            <TabsTrigger value="researched">Researched ({statusCounts.researched})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({statusCounts.in_progress})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({statusCounts.completed})</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <ContentPlanTable
            items={filteredItems}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onResearch={handleResearch}
            onCreateContent={handleCreateContent}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={setViewItem}
            onViewResearch={setViewItem}
            onCopy={handleCopy}
            onExport={handleExport}
            isResearching={isResearching}
            researchingId={researchingId}
          />
        )}
      </div>

      <CreateContentItemDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setEditItem(null); }}
        onSubmit={handleCreate}
        isLoading={isCreating}
        editItem={editItem}
      />

      <ContentFieldMappingDialog
        open={mappingDialogOpen}
        onClose={() => setMappingDialogOpen(false)}
        csvHeaders={csvHeaders}
        csvData={csvData}
        onMappingComplete={handleMappingComplete}
      />

      <ContentDetailSheet
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        item={viewItem}
      />

      <AlertDialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete content item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteConfirmItem?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContentPlan;
