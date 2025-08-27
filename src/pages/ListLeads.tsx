import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { ArrowLeft, Search, Users, ExternalLink } from "lucide-react";
import { useEventLeads } from "@/hooks/useEventLeads";
import { useEvents } from "@/hooks/useEvents";
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
  const { toast } = useToast();

  const pageSize = 50;
  
  const { leads, totalCount, isLoading, error } = useEventLeads(eventId || "", currentPage, pageSize);
  const { events } = useEvents();
  
  const currentEvent = events.find(event => event.id === eventId);
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSearch = async () => {
    if (!searchTerm.trim() || !eventId) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await LeadsService.searchLeads(eventId, searchTerm.trim());
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

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
  };

  const displayedLeads = searchTerm ? searchResults : leads;

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
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            <Users className="h-3 w-3 mr-1" />
            {searchTerm ? searchResults.length : totalCount} leads
          </Badge>
        </div>
      </div>

      {/* Lead Processing Pipeline */}
      <div className="mb-6">
        <LeadProcessingStepper eventId={eventId} />
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
            {searchTerm && (
              <Button variant="outline" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {searchTerm ? `Search Results (${searchResults.length})` : `All Leads (${totalCount})`}
          </CardTitle>
          <CardDescription>
            {searchTerm ? `Results for "${searchTerm}"` : "Manage and review lead information"}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                {searchTerm ? "No leads found" : "No leads uploaded yet"}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Try adjusting your search terms" 
                  : "Upload a CSV file to add leads to this list"
                }
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Validation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedLeads.map((lead) => (
                    <TableRow 
                      key={lead.id}
                      className={lead.validation_status === 'failed' ? 'opacity-60' : ''}
                    >
                      <TableCell className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </TableCell>
                      <TableCell>
                        <a 
                          href={`mailto:${lead.email}`} 
                          className="text-primary hover:underline"
                        >
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell>{lead.account_name}</TableCell>
                      <TableCell>{lead.title || '-'}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-pointer">
                                {lead.validation_status === 'completed' ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">
                                    Valid
                                  </Badge>
                                ) : lead.validation_status === 'failed' ? (
                                  <Badge variant="destructive">
                                    Invalid
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            {lead.validation_errors && lead.validation_errors.length > 0 && (
                              <TooltipContent>
                                <div className="max-w-sm">
                                  <p className="font-semibold mb-1">Validation Issues:</p>
                                  <ul className="text-sm list-disc list-inside space-y-1">
                                    {lead.validation_errors.map((error, index) => (
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
                        {lead.lead_status ? (
                          <Badge variant="outline">{lead.lead_status}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.mailing_city || lead.mailing_state_province || lead.mailing_country ? (
                          <div className="text-sm">
                            {[lead.mailing_city, lead.mailing_state_province, lead.mailing_country]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.phone || lead.mobile ? (
                          <div className="text-sm space-y-1">
                            {lead.phone && <div>{lead.phone}</div>}
                            {lead.mobile && <div className="text-muted-foreground">{lead.mobile}</div>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination - only show for non-search results */}
              {!searchTerm && totalPages > 1 && (
                <div className="mt-6 flex justify-center">
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