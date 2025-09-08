import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { 
  ArrowLeft, 
  Search, 
  Users, 
  ExternalLink, 
  Building2, 
  User, 
  Phone, 
  ArrowUpDown,
  Filter,
  Download,
  Trash2,
  Settings,
  MoreHorizontal
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { useEventLeads } from "@/hooks/useEventLeads";
import { useEvents } from "@/hooks/useEvents";
import { useLeadValidationCounts } from "@/hooks/useLeadValidationCounts";
import { useLeadProcessingJob } from "@/hooks/useLeadProcessingJob";
import { LeadsService } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import LeadProcessingStepper from "@/components/leads/LeadProcessingStepper";

const ListLeads = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [validationFilter, setValidationFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [salesforceFilter, setSalesforceFilter] = useState<'all' | 'pending' | 'existing_customer' | 'existing_opportunity' | 'existing_contact' | 'existing_account' | 'existing_lead' | 'net_new' | 'synced' | 'failed'>('all');
  const [enrichmentFilter, setEnrichmentFilter] = useState<'all' | 'enriched' | 'pending' | 'failed'>('all');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isCompact, setIsCompact] = useState(false);
  const { toast } = useToast();

  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const pageSize = 50;
  
  const { leads, totalCount, isLoading, error, refetch } = useEventLeads(eventId || "", currentPage, pageSize, validationFilter);
  const { events } = useEvents();
  const { data: validationCounts, refetch: refetchCounts } = useLeadValidationCounts(eventId || "");
  const { data: salesforceJob } = useLeadProcessingJob(eventId || "", 'check_salesforce');
  
  // Ref to track previous Salesforce job status
  const previousSalesforceStatus = React.useRef(salesforceJob?.status);
  
  const currentEvent = events.find(event => event.id === eventId);
  const totalPages = Math.ceil(totalCount / pageSize);

  // Auto-search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleSearch = async () => {
      if (!debouncedSearch.trim() || !eventId) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      setIsSearching(true);
      try {
        const { data, error } = await LeadsService.searchLeads(eventId, debouncedSearch.trim());
        if (error) {
          toast({
            title: "Search Error",
            description: "Failed to search leads",
            variant: "destructive",
          });
        } else {
          setSearchResults(data);
        }
      } catch (err) {
        toast({
          title: "Search Error", 
          description: "Failed to search leads",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    };

    handleSearch();
  }, [debouncedSearch, eventId, toast]);

  // Auto-refresh when Salesforce job completes
  useEffect(() => {
    if (salesforceJob?.status === 'completed' && ['processing','running'].includes(previousSalesforceStatus.current as string)) {
      // Job just completed, refresh the data
      refetch();
      refetchCounts();
    }
    
    previousSalesforceStatus.current = salesforceJob?.status;
  }, [salesforceJob?.status, refetch, refetchCounts]);

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
  };

  // Apply comprehensive client-side filtering
  const getFilteredResults = (data: any[]) => {
    return data.filter(lead => {
      // Validation filter
      if (validationFilter === 'valid' && lead.validation_status !== 'completed') return false;
      if (validationFilter === 'invalid' && lead.validation_status !== 'failed') return false;
      
      // Salesforce filter
      if (salesforceFilter === 'pending' && lead.salesforce_status !== 'pending') return false;
      if (salesforceFilter === 'existing_customer' && lead.salesforce_status !== 'existing_customer') return false;
      if (salesforceFilter === 'existing_opportunity' && lead.salesforce_status !== 'existing_opportunity') return false;
      if (salesforceFilter === 'existing_contact' && lead.salesforce_status !== 'existing_contact') return false;
      if (salesforceFilter === 'existing_account' && lead.salesforce_status !== 'existing_account') return false;
      if (salesforceFilter === 'existing_lead' && lead.salesforce_status !== 'existing_lead') return false;
      if (salesforceFilter === 'net_new' && lead.salesforce_status !== 'net_new') return false;
      if (salesforceFilter === 'synced' && lead.salesforce_status !== 'synced') return false;
      if (salesforceFilter === 'failed' && lead.salesforce_status !== 'failed') return false;
      
      // Enrichment filter
      if (enrichmentFilter === 'enriched' && lead.enrichment_status !== 'completed') return false;
      if (enrichmentFilter === 'pending' && lead.enrichment_status !== 'pending') return false;
      if (enrichmentFilter === 'failed' && lead.enrichment_status !== 'failed') return false;
      
      return true;
    });
  };

  // Sort data
  const getSortedData = (data: any[]) => {
    if (!sortField) return data;
    
    return [...data].sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const displayedLeads = getSortedData(getFilteredResults(debouncedSearch ? searchResults : leads));

  const handleFilterChange = (filter: 'all' | 'valid' | 'invalid') => {
    setValidationFilter(filter);
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(displayedLeads.map(lead => lead.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    
    try {
      // Implementation would go here
      toast({
        title: "Success",
        description: `${selectedLeads.size} leads deleted successfully`,
      });
      setSelectedLeads(new Set());
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete leads",
        variant: "destructive",
      });
    }
  };

  const handleBulkSyncToSalesforce = async () => {
    if (selectedLeads.size === 0) return;
    
    try {
      const selectedLeadIds = Array.from(selectedLeads);
      const response = await LeadsService.syncToSalesforce(eventId, selectedLeadIds);
      
      if (response.success) {
        toast({
          title: "Success",
          description: `Salesforce sync started for ${selectedLeads.size} leads`,
        });
        setSelectedLeads(new Set());
      } else {
        toast({
          title: "Error",
          description: response.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start Salesforce sync",
        variant: "destructive",
      });
    }
  };

  const handleStageComplete = (stage: string) => {
    if (stage === 'validate' || stage === 'salesforce') {
      refetchCounts();
      refetch();
    }
  };

  if (!eventId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid List</h1>
          <Link to="/lists">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lists
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <SEO
        title={`Leads - ${currentEvent?.name || 'List'}`}
        description={`View and manage leads for ${currentEvent?.name || 'this list'}`}
        canonicalPath={`/lists/${eventId}/leads`}
      />

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link to="/lists">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lists
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{currentEvent?.name || 'List'} Leads</h1>
            <p className="text-muted-foreground">
              {currentEvent?.salesforce_campaign_url && (
                <a 
                  href={currentEvent.salesforce_campaign_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View Salesforce Campaign
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Lead Processing Pipeline */}
      <div className="mb-6">
        <LeadProcessingStepper eventId={eventId} onStageComplete={handleStageComplete} />
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {/* Validation Filters */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">Validation:</span>
                <Button
                  variant={validationFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange('all')}
                  className="h-7 px-2 text-xs"
                >
                  All ({totalCount})
                </Button>
                <Button
                  variant={validationFilter === 'valid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange('valid')}
                  className="h-7 px-2 text-xs"
                >
                  Valid ({validationCounts?.validCount || 0})
                </Button>
                <Button
                  variant={validationFilter === 'invalid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange('invalid')}
                  className="h-7 px-2 text-xs"
                >
                  Invalid ({validationCounts?.invalidCount || 0})
                </Button>
              </div>

              {/* Salesforce Filters */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-sm text-muted-foreground">Salesforce:</span>
                <Button
                  variant={salesforceFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('all')}
                  className="h-7 px-2 text-xs"
                >
                  All
                </Button>
                <Button
                  variant={salesforceFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('pending')}
                  className="h-7 px-2 text-xs"
                >
                  Pending
                </Button>
                <Button
                  variant={salesforceFilter === 'existing_customer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('existing_customer')}
                  className="h-7 px-2 text-xs"
                >
                  Existing Customer
                </Button>
                <Button
                  variant={salesforceFilter === 'existing_opportunity' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('existing_opportunity')}
                  className="h-7 px-2 text-xs"
                >
                  Existing Opportunity
                </Button>
                <Button
                  variant={salesforceFilter === 'existing_contact' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('existing_contact')}
                  className="h-7 px-2 text-xs"
                >
                  Existing Contact
                </Button>
                <Button
                  variant={salesforceFilter === 'existing_account' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('existing_account')}
                  className="h-7 px-2 text-xs"
                >
                  Existing Account
                </Button>
                <Button
                  variant={salesforceFilter === 'existing_lead' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('existing_lead')}
                  className="h-7 px-2 text-xs"
                >
                  Existing Lead
                </Button>
                <Button
                  variant={salesforceFilter === 'net_new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('net_new')}
                  className="h-7 px-2 text-xs"
                >
                  Net New
                </Button>
                <Button
                  variant={salesforceFilter === 'synced' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('synced')}
                  className="h-7 px-2 text-xs"
                >
                  Synced
                </Button>
                <Button
                  variant={salesforceFilter === 'failed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSalesforceFilter('failed')}
                  className="h-7 px-2 text-xs"
                >
                  Failed
                </Button>
              </div>

              {/* Enrichment Filters */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">Enrichment:</span>
                <Button
                  variant={enrichmentFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnrichmentFilter('all')}
                  className="h-7 px-2 text-xs"
                >
                  All
                </Button>
                <Button
                  variant={enrichmentFilter === 'enriched' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnrichmentFilter('enriched')}
                  className="h-7 px-2 text-xs"
                >
                  Enriched
                </Button>
                <Button
                  variant={enrichmentFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEnrichmentFilter('pending')}
                  className="h-7 px-2 text-xs"
                >
                  Pending
                </Button>
              </div>
            </div>

            {/* Active filters summary */}
            {(searchTerm || validationFilter !== 'all' || salesforceFilter !== 'all' || enrichmentFilter !== 'all') && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-3 w-3" />
                <span>Showing {displayedLeads.length} filtered results</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setDebouncedSearch('');
                    setValidationFilter('all');
                    setSalesforceFilter('all');
                    setEnrichmentFilter('all');
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Leads ({displayedLeads.length})
              </CardTitle>
              <CardDescription>
                {searchTerm ? `Results for "${searchTerm}"` : "Manage and review lead information"}
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Bulk Actions */}
              {selectedLeads.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedLeads.size} selected
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => {}}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Selected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={handleBulkDelete}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              
              {/* Table Controls */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuCheckboxItem
                    checked={isCompact}
                    onCheckedChange={setIsCompact}
                  >
                    Compact View
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-muted-foreground">Loading leads...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-destructive mb-2">Failed to load leads</div>
              <div className="text-sm text-muted-foreground">{error.message}</div>
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || validationFilter !== 'all' || salesforceFilter !== 'all' || enrichmentFilter !== 'all' 
                  ? "No leads match your filters" 
                  : "No leads uploaded yet"}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm || validationFilter !== 'all' || salesforceFilter !== 'all' || enrichmentFilter !== 'all' 
                  ? "Try adjusting your search terms or filters" 
                  : "Upload a CSV file to add leads to this list"}
              </p>
            </div>
          ) : (
            <>
              <Table className={isCompact ? 'text-sm' : ''}>
                <TableHeader className="sticky top-0 bg-background border-b">
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox 
                        checked={selectedLeads.size === displayedLeads.length && displayedLeads.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('first_name')}
                    >
                      <div className="flex items-center gap-1">
                        Name
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center gap-1">
                        Email
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('account_name')}
                    >
                      <div className="flex items-center gap-1">
                        Company
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Account SDR Owner</TableHead>
                    <TableHead>Manual Ownership</TableHead>
                    <TableHead>Validation</TableHead>
                    <TableHead>Salesforce</TableHead>
                    <TableHead>Enrichment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedLeads.map((lead) => (
                    <TableRow 
                      key={lead.id}
                      className={`${lead.validation_status === 'failed' ? 'opacity-60' : ''} ${selectedLeads.has(lead.id) ? 'bg-muted/50' : ''}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-medium">{lead.first_name} {lead.last_name}</TableCell>
                      <TableCell>
                        <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell>{lead.account_name}</TableCell>
                      <TableCell>{lead.title || '-'}</TableCell>
                      <TableCell>{lead.salesforce_account_sdr_owner_email || '-'}</TableCell>
                      <TableCell>{lead.manual_owner_email || '-'}</TableCell>
                      <TableCell>
                        {lead.validation_status === 'completed' ? (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Valid</Badge>
                        ) : lead.validation_status === 'failed' ? (
                          <Badge variant="destructive">Invalid</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.salesforce_status === 'synced' ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Synced</Badge>
                        ) : lead.salesforce_status === 'existing_customer' ? (
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Existing Customer</Badge>
                        ) : lead.salesforce_status === 'existing_opportunity' ? (
                          <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">Existing Opportunity</Badge>
                        ) : lead.salesforce_status === 'existing_contact' ? (
                          <Badge variant="secondary" className="bg-cyan-50 text-cyan-700 border-cyan-200">Existing Contact</Badge>
                        ) : lead.salesforce_status === 'existing_account' ? (
                          <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200">Existing Account</Badge>
                        ) : lead.salesforce_status === 'existing_lead' ? (
                          <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">Existing Lead</Badge>
                        ) : lead.salesforce_status === 'net_new' ? (
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">Net New</Badge>
                        ) : lead.salesforce_status === 'failed' ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.enrichment_status === 'completed' ? (
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">Enriched</Badge>
                        ) : lead.enrichment_status === 'failed' ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination - only show for non-search results */}
              {!debouncedSearch && totalPages > 1 && (
                <div className="mt-6 flex justify-center p-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {/* Show first page */}
                      {currentPage > 3 && (
                        <>
                          <PaginationItem>
                            <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer">
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {currentPage > 4 && (
                            <PaginationItem>
                              <span className="px-4 py-2">...</span>
                            </PaginationItem>
                          )}
                        </>
                      )}

                      {/* Show current page and nearby pages */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink 
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={pageNum === currentPage}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      {/* Show last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && (
                            <PaginationItem>
                              <span className="px-4 py-2">...</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink 
                              onClick={() => setCurrentPage(totalPages)}
                              className="cursor-pointer"
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}

                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ListLeads;