import React, { useState } from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  AlertCircle 
} from "lucide-react";

interface LeadTableRowProps {
  lead: any;
  isSelected: boolean;
  onSelectChange: (selected: boolean) => void;
  isCompact?: boolean;
}

export const LeadTableRow: React.FC<LeadTableRowProps> = ({ 
  lead, 
  isSelected, 
  onSelectChange,
  isCompact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getValidationBadge = () => {
    if (lead.validation_status === 'completed') {
      return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Valid</Badge>;
    } else if (lead.validation_status === 'failed') {
      return <Badge variant="destructive">Invalid</Badge>;
    } else {
      return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getSalesforceStatusBadge = () => {
    if (lead.salesforce_status === 'completed') {
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Synced</Badge>;
    } else if (lead.salesforce_status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    } else {
      return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getEnrichmentBadge = () => {
    if (lead.enrichment_status === 'completed') {
      return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Enriched</Badge>;
    } else if (lead.enrichment_status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    } else {
      return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <>
      <TableRow 
        className={`
          ${lead.validation_status === 'failed' ? 'opacity-60' : ''} 
          ${isSelected ? 'bg-muted/50' : ''} 
          ${isCompact ? 'h-12' : 'h-16'}
          hover:bg-muted/30 transition-colors cursor-pointer
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={isSelected}
            onCheckedChange={onSelectChange}
          />
        </TableCell>
        
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
        </TableCell>

        <TableCell className="font-medium min-w-[140px]">
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-muted-foreground" />
            <span>{lead.first_name} {lead.last_name}</span>
          </div>
        </TableCell>

        <TableCell className="min-w-[180px]">
          <div className="flex items-center gap-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <a 
              href={`mailto:${lead.email}`} 
              className="text-primary hover:underline text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {lead.email}
            </a>
          </div>
        </TableCell>

        <TableCell className="min-w-[140px]">
          <div className="flex items-center gap-2">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{lead.account_name}</span>
          </div>
        </TableCell>

        <TableCell className="min-w-[120px]">
          <span className="text-sm text-muted-foreground">
            {lead.title || '-'}
          </span>
        </TableCell>

        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                  {getValidationBadge()}
                </div>
              </TooltipTrigger>
              {lead.validation_errors && lead.validation_errors.length > 0 && (
                <TooltipContent>
                  <div className="max-w-sm">
                    <p className="font-semibold mb-1">Validation Issues:</p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      {lead.validation_errors.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>

        <TableCell>
          {getSalesforceStatusBadge()}
        </TableCell>

        <TableCell>
          {getEnrichmentBadge()}
        </TableCell>
      </TableRow>

      <CollapsibleContent asChild>
        <TableRow className="bg-muted/20">
          <TableCell colSpan={9} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Contact Details */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Details
                </h4>
                <div className="space-y-1 text-muted-foreground">
                  {lead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.mobile && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{lead.mobile} (Mobile)</span>
                    </div>
                  )}
                  {lead.linkedin && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      <a 
                        href={lead.linkedin} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </h4>
                <div className="space-y-1 text-muted-foreground">
                  {(lead.mailing_city || lead.mailing_state_province || lead.mailing_country) && (
                    <div>
                      {[lead.mailing_city, lead.mailing_state_province, lead.mailing_country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                  {(lead.zoominfo_company_state || lead.zoominfo_company_country) && (
                    <div className="text-primary font-medium">
                      📍 ZoomInfo: {[lead.zoominfo_company_state, lead.zoominfo_company_country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Salesforce Status */}
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Salesforce Status
                </h4>
                <div className="space-y-1 text-muted-foreground">
                  {lead.salesforce_status_detail && (
                    <Badge variant="outline" className="text-xs">
                      {lead.salesforce_status_detail.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  )}
                  <div className="grid grid-cols-1 gap-1 mt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={lead.sf_existing_account || false} disabled className="h-3 w-3" />
                      <span className="text-xs">Existing Account</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={lead.sf_existing_contact || false} disabled className="h-3 w-3" />
                      <span className="text-xs">Existing Contact</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={lead.sf_existing_lead || false} disabled className="h-3 w-3" />
                      <span className="text-xs">Existing Lead</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enriched Data */}
              {(lead.zoominfo_phone_1 || lead.zoominfo_phone_2) && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    ZoomInfo Data
                  </h4>
                  <div className="space-y-1 text-primary font-medium">
                    {lead.zoominfo_phone_1 && (
                      <div className="flex items-center gap-2">
                        📞 {lead.zoominfo_phone_1}
                      </div>
                    )}
                    {lead.zoominfo_phone_2 && (
                      <div className="flex items-center gap-2">
                        📞 {lead.zoominfo_phone_2}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {(lead.sync_errors && lead.sync_errors.length > 0) && (
                <div className="space-y-2 col-span-full">
                  <h4 className="font-semibold flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Sync Errors
                  </h4>
                  <div className="space-y-1">
                    {lead.sync_errors.map((error: any, index: number) => (
                      <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <div className="font-medium">{error.stage}</div>
                        <div>{error.error}</div>
                        <div className="text-xs text-red-500 mt-1">
                          {new Date(error.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </>
  );
};

export default LeadTableRow;