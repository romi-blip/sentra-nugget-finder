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

interface FieldMappingDialogProps {
  open: boolean;
  onClose: () => void;
  csvHeaders: string[];
  csvData: any[];
  onMappingComplete: (mapping: FieldMapping[]) => void;
  eventId: string;
}

const SYSTEM_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'account_name', label: 'Account Name', required: true },
  { key: 'title', label: 'Title', required: false },
  { key: 'lead_status', label: 'Lead Status', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'mobile', label: 'Mobile', required: false },
  { key: 'mailing_street', label: 'Mailing Street', required: false },
  { key: 'mailing_city', label: 'Mailing City', required: false },
  { key: 'mailing_state_province', label: 'Mailing State/Province', required: false },
  { key: 'mailing_zip_postal_code', label: 'Mailing Zip/Postal Code', required: false },
  { key: 'mailing_country', label: 'Mailing Country', required: false },
  { key: 'linkedin', label: 'LinkedIn', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'latest_lead_source', label: 'Latest Lead Source', required: false },
  { key: 'latest_lead_source_details', label: 'Latest Lead Source Details', required: false },
  { key: 'lead_exclusion_field', label: 'Lead Exclusion Field', required: false },
  { key: 'email_opt_out', label: 'Email Opt Out', required: false },
  { key: 'manual_owner_email', label: 'Manual Owner Email', required: false },
];

export const FieldMappingDialog: React.FC<FieldMappingDialogProps> = ({
  open,
  onClose,
  csvHeaders,
  csvData,
  onMappingComplete,
  eventId,
}) => {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  // Auto-suggest mappings based on header similarity
  const suggestMapping = (systemField: string, csvHeaders: string[]): string => {
    const systemFieldLower = systemField.toLowerCase().replace('_', ' ');
    
    // Direct matches first
    for (const header of csvHeaders) {
      if (header.toLowerCase() === systemFieldLower) {
        return header;
      }
    }

    // Partial matches with common variations
    const variations: Record<string, string[]> = {
      'first_name': ['first name', 'firstname', 'fname', 'given name'],
      'last_name': ['last name', 'lastname', 'lname', 'surname', 'family name'],
      'email': ['email', 'email address', 'e-mail'],
      'account_name': ['account name', 'company', 'company name', 'organization'],
      'title': ['title', 'job title', 'position'],
      'phone': ['phone', 'phone number', 'telephone', 'work phone'],
      'mobile': ['mobile', 'cell', 'cell phone', 'mobile phone'],
      'mailing_street': ['street', 'address', 'mailing street', 'street address'],
      'mailing_city': ['city', 'mailing city'],
      'mailing_state_province': ['state', 'province', 'state/province', 'mailing state'],
      'mailing_zip_postal_code': ['zip', 'postal code', 'zipcode', 'zip code'],
      'mailing_country': ['country', 'mailing country'],
      'linkedin': ['linkedin', 'linkedin url', 'linkedin profile'],
      'lead_status': ['status', 'lead status'],
    };

    const searchTerms = variations[systemField] || [systemFieldLower];
    
    for (const term of searchTerms) {
      for (const header of csvHeaders) {
        if (header.toLowerCase().includes(term) || term.includes(header.toLowerCase())) {
          return header;
        }
      }
    }

    return '';
  };

  useEffect(() => {
    if (open && csvHeaders.length > 0) {
      // Load saved mappings from localStorage
      const savedMappingsKey = `fieldMappings_${eventId}`;
      const savedMappings = localStorage.getItem(savedMappingsKey);
      
      let initialMappings: FieldMapping[] = [];
      
      if (savedMappings) {
        try {
          const parsed = JSON.parse(savedMappings);
          // Validate that saved CSV columns still exist
          initialMappings = parsed.filter((mapping: FieldMapping) => 
            csvHeaders.includes(mapping.csvColumn)
          );
        } catch (e) {
          console.warn('Failed to parse saved mappings');
        }
      }
      
      // Auto-suggest for unmapped fields
      const mappedSystemFields = new Set(initialMappings.map(m => m.systemField));
      const suggestedMappings = SYSTEM_FIELDS
        .filter(field => !mappedSystemFields.has(field.key))
        .map(field => {
          const suggestedColumn = suggestMapping(field.key, csvHeaders);
          return {
            csvColumn: suggestedColumn,
            systemField: field.key,
          };
        })
        .filter(mapping => mapping.csvColumn); // Only include if suggestion found

      setFieldMappings([...initialMappings, ...suggestedMappings]);
    }
  }, [open, csvHeaders, eventId]);

  const updateMapping = (systemField: string, csvColumn: string) => {
    setFieldMappings(prev => {
      const existing = prev.find(m => m.systemField === systemField);
      if (existing) {
        return prev.map(m => 
          m.systemField === systemField 
            ? { ...m, csvColumn } 
            : m
        );
      } else {
        return [...prev, { systemField, csvColumn }];
      }
    });
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
    
    // Save mappings to localStorage
    const savedMappingsKey = `fieldMappings_${eventId}`;
    localStorage.setItem(savedMappingsKey, JSON.stringify(validMappings));
    
    onMappingComplete(validMappings);
    onClose();
  };

  const requiredStatus = getRequiredFieldsStatus();
  const previewData = csvData.slice(0, 3); // Show first 3 rows for preview

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map CSV Fields</DialogTitle>
          <DialogDescription>
            Map your CSV columns to system fields. Required fields must be mapped to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Card */}
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
                  Total fields mapped: {fieldMappings.filter(m => m.csvColumn).length}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Mappings */}
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
                      <Label className="text-xs flex items-center gap-1">
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

            {/* Preview */}
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
                          {csvHeaders.slice(0, 4).map(header => (
                            <TableHead key={header} className="text-xs">
                              {header}
                            </TableHead>
                          ))}
                          {csvHeaders.length > 4 && (
                            <TableHead className="text-xs">
                              +{csvHeaders.length - 4} more
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, index) => (
                          <TableRow key={index}>
                            {csvHeaders.slice(0, 4).map(header => (
                              <TableCell key={header} className="text-xs">
                                {String(row[header] || '').substring(0, 30)}
                                {String(row[header] || '').length > 30 ? '...' : ''}
                              </TableCell>
                            ))}
                            {csvHeaders.length > 4 && (
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
            Continue with Mapping ({fieldMappings.filter(m => m.csvColumn).length} fields)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};