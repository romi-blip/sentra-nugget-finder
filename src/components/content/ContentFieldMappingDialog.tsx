import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle } from "lucide-react";

interface FieldMapping {
  csvColumn: string;
  systemField: string;
}

interface ContentFieldMappingDialogProps {
  open: boolean;
  onClose: () => void;
  csvHeaders: string[];
  csvData: Record<string, string>[];
  onMappingComplete: (mapping: FieldMapping[]) => void;
}

const SYSTEM_FIELDS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'strategic_purpose', label: 'Strategic Purpose', required: true },
  { key: 'target_keywords', label: 'Target Keywords', required: false },
  { key: 'outline', label: 'Outline', required: false },
];

export const ContentFieldMappingDialog: React.FC<ContentFieldMappingDialogProps> = ({
  open,
  onClose,
  csvHeaders,
  csvData,
  onMappingComplete,
}) => {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  const suggestMapping = (systemField: string, headers: string[]): string => {
    const variations: Record<string, string[]> = {
      'title': ['title', 'name', 'topic', 'content title', 'headline'],
      'strategic_purpose': ['purpose', 'goal', 'strategy', 'strategic purpose', 'objective', 'why'],
      'target_keywords': ['keywords', 'seo', 'target keywords', 'tags', 'search terms'],
      'outline': ['outline', 'structure', 'format', 'content outline', 'sections'],
    };

    const searchTerms = variations[systemField] || [systemField.replace('_', ' ')];
    
    for (const term of searchTerms) {
      for (const header of headers) {
        const headerLower = header.toLowerCase();
        if (headerLower === term || headerLower.includes(term) || term.includes(headerLower)) {
          return header;
        }
      }
    }

    return '';
  };

  useEffect(() => {
    if (open && csvHeaders.length > 0) {
      const initialMappings = SYSTEM_FIELDS.map(field => ({
        csvColumn: suggestMapping(field.key, csvHeaders),
        systemField: field.key,
      }));
      setFieldMappings(initialMappings);
    }
  }, [open, csvHeaders]);

  const updateMapping = (systemField: string, csvColumn: string) => {
    setFieldMappings(prev => 
      prev.map(m => 
        m.systemField === systemField 
          ? { ...m, csvColumn } 
          : m
      )
    );
  };

  const getRequiredFieldsStatus = () => {
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required);
    const mappedRequiredFields = requiredFields.filter(field => 
      fieldMappings.some(mapping => 
        mapping.systemField === field.key && mapping.csvColumn
      )
    );
    return {
      total: requiredFields.length,
      mapped: mappedRequiredFields.length,
      complete: mappedRequiredFields.length === requiredFields.length
    };
  };

  const handleComplete = () => {
    const validMappings = fieldMappings.filter(mapping => mapping.csvColumn);
    onMappingComplete(validMappings);
    onClose();
  };

  const requiredStatus = getRequiredFieldsStatus();
  const previewData = csvData.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map CSV Fields</DialogTitle>
          <DialogDescription>
            Map your CSV columns to content plan fields. Required fields must be mapped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {requiredStatus.complete ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
                Mapping Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  Required fields: {requiredStatus.mapped}/{requiredStatus.total}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total rows: {csvData.length}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Field Mappings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {SYSTEM_FIELDS.map(field => {
                  const mapping = fieldMappings.find(m => m.systemField === field.key);
                  return (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-2">
                        {field.label}
                        {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                      </Label>
                      <Select
                        value={mapping?.csvColumn || 'UNMAPPED'}
                        onValueChange={(value) => updateMapping(field.key, value === 'UNMAPPED' ? '' : value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select CSV column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNMAPPED">-- Not mapped --</SelectItem>
                          {csvHeaders.map(header => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Data Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {previewData.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {csvHeaders.slice(0, 3).map(header => (
                            <TableHead key={header} className="text-xs">
                              {header}
                            </TableHead>
                          ))}
                          {csvHeaders.length > 3 && (
                            <TableHead className="text-xs">
                              +{csvHeaders.length - 3} more
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, index) => (
                          <TableRow key={index}>
                            {csvHeaders.slice(0, 3).map(header => (
                              <TableCell key={header} className="text-xs">
                                {String(row[header] || '').substring(0, 25)}
                                {String(row[header] || '').length > 25 ? '...' : ''}
                              </TableCell>
                            ))}
                            {csvHeaders.length > 3 && (
                              <TableCell className="text-xs text-muted-foreground">
                                ...
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={!requiredStatus.complete}
          >
            Import {csvData.length} Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
