import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, Pencil, Trash2, Eye, Copy, Download, Loader2, FileText, RefreshCw } from "lucide-react";
import { ContentPlanItem } from "@/services/contentService";

interface ContentPlanTableProps {
  items: ContentPlanItem[];
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onResearch: (item: ContentPlanItem) => void;
  onCreateContent: (item: ContentPlanItem) => void;
  onEdit: (item: ContentPlanItem) => void;
  onDelete: (item: ContentPlanItem) => void;
  onView: (item: ContentPlanItem) => void;
  onViewResearch: (item: ContentPlanItem) => void;
  onCopy: (item: ContentPlanItem) => void;
  onExport: (item: ContentPlanItem) => void;
  isResearching?: boolean;
  researchingId?: string;
  isGenerating?: boolean;
  generatingId?: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  researching: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  researched: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  generating: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  researching: "Researching...",
  researched: "Researched",
  generating: "Generating...",
  in_progress: "In Progress",
  completed: "Completed",
};

export const ContentPlanTable: React.FC<ContentPlanTableProps> = ({
  items,
  selectedIds,
  onSelectIds,
  onResearch,
  onCreateContent,
  onEdit,
  onDelete,
  onView,
  onViewResearch,
  onCopy,
  onExport,
  isResearching,
  researchingId,
  isGenerating,
  generatingId,
}) => {
  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      onSelectIds([]);
    } else {
      onSelectIds(items.map(item => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectIds(selectedIds.filter(i => i !== id));
    } else {
      onSelectIds([...selectedIds, id]);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No content items yet. Add one manually or upload a CSV.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.length === items.length && items.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden md:table-cell">Strategic Purpose</TableHead>
            <TableHead className="hidden lg:table-cell">Keywords</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="max-w-xs truncate">{item.title}</div>
                {item.content && (
                  <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate">
                    {item.content.substring(0, 80)}...
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="max-w-xs truncate text-muted-foreground">
                  {item.strategic_purpose}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="max-w-xs truncate text-muted-foreground">
                  {item.target_keywords || "-"}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={`${statusColors[item.status] || statusColors.draft} ${(item.status === 'researching' || item.status === 'generating') ? 'animate-pulse' : ''}`}>
                  {statusLabels[item.status] || item.status}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(item.status === 'completed' || item.content) && (
                      <>
                        <DropdownMenuItem onClick={() => onView(item)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Content
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopy(item)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Content
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport(item)}>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onCreateContent(item)}
                          disabled={isGenerating || item.status === 'generating'}
                        >
                          {isGenerating && generatingId === item.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          {isGenerating && generatingId === item.id ? 'Generating...' : 'Re-generate Content'}
                        </DropdownMenuItem>
                      </>
                    )}
                    {item.research_notes && (
                      <DropdownMenuItem onClick={() => onViewResearch(item)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Research
                      </DropdownMenuItem>
                    )}
                    {!item.content && item.status !== 'completed' && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => onResearch(item)}
                          disabled={isResearching || item.status === 'researching'}
                        >
                          {isResearching && researchingId === item.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4 mr-2" />
                          )}
                          {isResearching && researchingId === item.id ? 'Researching...' : 'Research Topic'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onCreateContent(item)}
                          disabled={isGenerating || item.status === 'generating' || !item.research_notes}
                        >
                          {isGenerating && generatingId === item.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4 mr-2" />
                          )}
                          {isGenerating && generatingId === item.id ? 'Generating...' : 'Create Content'}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(item)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
