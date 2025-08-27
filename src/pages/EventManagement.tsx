import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Calendar, CalendarDays, Edit, Trash2, Upload, Users, Plus, Download } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { useEventLeads } from "@/hooks/useEventLeads";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import Papa from "papaparse";
import SEO from "@/components/SEO";
import type { Event } from "@/services/eventsService";
import type { CreateLeadPayload } from "@/services/leadsService";

const EventManagement = () => {
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [eventForm, setEventForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    details: "",
  });

  const { toast } = useToast();
  const { events, isLoading, createEvent, updateEvent, deleteEvent, isCreating, isUpdating, isDeleting } = useEvents();
  const { leads, upsertLeads, isUploadingLeads } = useEventLeads(selectedEvent?.id || "", 1, 1000);

  const handleCreateEvent = () => {
    if (!eventForm.name || !eventForm.start_date || !eventForm.end_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (new Date(eventForm.end_date) < new Date(eventForm.start_date)) {
      toast({
        title: "Validation Error",
        description: "End date cannot be before start date",
        variant: "destructive",
      });
      return;
    }

    createEvent(eventForm);
    setCreateEventOpen(false);
    setEventForm({ name: "", start_date: "", end_date: "", details: "" });
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEventForm({
      name: event.name,
      start_date: event.start_date,
      end_date: event.end_date,
      details: event.details || "",
    });
  };

  const handleUpdateEvent = () => {
    if (!editingEvent) return;

    if (!eventForm.name || !eventForm.start_date || !eventForm.end_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (new Date(eventForm.end_date) < new Date(eventForm.start_date)) {
      toast({
        title: "Validation Error",
        description: "End date cannot be before start date",
        variant: "destructive",
      });
      return;
    }

    updateEvent({ id: editingEvent.id, payload: eventForm });
    setEditingEvent(null);
    setEventForm({ name: "", start_date: "", end_date: "", details: "" });
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(eventId);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedEvent) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setUploadProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        
        if (data.length === 0) {
          toast({
            title: "Empty File",
            description: "The CSV file is empty",
            variant: "destructive",
          });
          return;
        }

        // Validate required fields
        const requiredFields = ['First Name', 'Last Name', 'Email', 'Account Name'];
        const headers = Object.keys(data[0]);
        const missingFields = requiredFields.filter(field => !headers.includes(field));

        if (missingFields.length > 0) {
          toast({
            title: "Missing Required Fields",
            description: `Missing columns: ${missingFields.join(', ')}`,
            variant: "destructive",
          });
          return;
        }

        // Transform data to match our schema
        const leads: CreateLeadPayload[] = data.map(row => ({
          event_id: selectedEvent.id,
          lead_status: row['Lead Status'] || '',
          first_name: row['First Name']?.trim() || '',
          last_name: row['Last Name']?.trim() || '',
          email: row['Email']?.trim() || '',
          account_name: row['Account Name']?.trim() || '',
          title: row['Title'] || '',
          lead_exclusion_field: row['Lead Exclusion Field'] || '',
          mailing_street: row['Mailing Street'] || '',
          mailing_city: row['Mailing City'] || '',
          mailing_state_province: row['Mailing State / Province'] || '',
          mailing_zip_postal_code: row['Mailing Zip / Postal Code'] || '',
          mailing_country: row['Mailing Country'] || '',
          notes: row['Notes'] || '',
          phone: row['Phone'] || '',
          mobile: row['Mobile'] || '',
          email_opt_out: row['Email Opt Out']?.toLowerCase() === 'true' || false,
          linkedin: row['LinkedIn'] || '',
          latest_lead_source: row['Latest Lead Source'] || '',
          latest_lead_source_details: row['Latest Lead Source Details'] || '',
        }));

        // Filter out invalid rows
        const validLeads = leads.filter(lead => 
          lead.first_name && lead.last_name && lead.email && lead.account_name
        );

        if (validLeads.length === 0) {
          toast({
            title: "No Valid Leads",
            description: "No leads found with all required fields",
            variant: "destructive",
          });
          return;
        }

        if (validLeads.length !== leads.length) {
          toast({
            title: "Some Leads Skipped",
            description: `${leads.length - validLeads.length} leads were skipped due to missing required fields`,
            variant: "destructive",
          });
        }

        // Upload leads in batches
        const batchSize = 500;
        const batches = [];
        for (let i = 0; i < validLeads.length; i += batchSize) {
          batches.push(validLeads.slice(i, i + batchSize));
        }

        let processedBatches = 0;
        const processBatch = async (batchIndex: number) => {
          const batch = batches[batchIndex];
          upsertLeads({ eventId: selectedEvent.id, leads: batch });
          processedBatches++;
          setUploadProgress((processedBatches / batches.length) * 100);
        };

        // Process first batch immediately
        if (batches.length > 0) {
          processBatch(0);
        }

        setUploadDialogOpen(false);
        event.target.value = ''; // Reset file input
      },
      error: (error) => {
        toast({
          title: "Parse Error",
          description: `Failed to parse CSV: ${error.message}`,
          variant: "destructive",
        });
      }
    });
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Lead Status': '',
        'First Name': 'John',
        'Last Name': 'Doe',
        'Email': 'john.doe@example.com',
        'Account Name': 'ACME Corp',
        'Title': 'Sales Manager',
        'Lead Exclusion Field': '',
        'Mailing Street': '123 Main St',
        'Mailing City': 'Anytown',
        'Mailing State / Province': 'CA',
        'Mailing Zip / Postal Code': '12345',
        'Mailing Country': 'USA',
        'Notes': '',
        'Phone': '+1-555-123-4567',
        'Mobile': '+1-555-987-6543',
        'Email Opt Out': 'false',
        'LinkedIn': 'https://linkedin.com/in/johndoe',
        'Latest Lead Source': '',
        'Latest Lead Source Details': ''
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'leads_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <SEO
        title="List Management"
        description="Manage lists and upload lead lists for marketing campaigns"
        canonicalPath="/lists"
      />

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">List Management</h1>
          <p className="text-muted-foreground">Create lists and manage leads</p>
        </div>
        <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New List</DialogTitle>
              <DialogDescription>Add a new list to manage leads for</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-name">List Name *</Label>
                <Input
                  id="event-name"
                  value={eventForm.name}
                  onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter list name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="event-details">Details</Label>
                <Textarea
                  id="event-details"
                  value={eventForm.details}
                  onChange={(e) => setEventForm(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="List description or notes"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateEvent} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create List"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-muted-foreground">Loading lists...</div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Lists
            </CardTitle>
            <CardDescription>Manage your lists and their associated leads</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No lists yet</h3>
                <p className="text-muted-foreground mb-4">Create your first list to start managing leads</p>
                <Button onClick={() => setCreateEventOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create List
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>List Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>{format(new Date(event.start_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(event.end_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          <Users className="h-3 w-3 mr-1" />
                          {event.lead_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEvent(event);
                              setUploadDialogOpen(true);
                            }}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload Leads
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEvent(event)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete List</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{event.name}"? This will also delete all associated leads. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
            <DialogDescription>Update list details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-event-name">List Name *</Label>
              <Input
                id="edit-event-name"
                value={eventForm.name}
                onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter list name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start-date">Start Date *</Label>
                <Input
                  id="edit-start-date"
                  type="date"
                  value={eventForm.start_date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-end-date">End Date *</Label>
                <Input
                  id="edit-end-date"
                  type="date"
                  value={eventForm.end_date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
                <Label htmlFor="edit-event-details">Details</Label>
                <Textarea
                  id="edit-event-details"
                  value={eventForm.details}
                  onChange={(e) => setEventForm(prev => ({ ...prev, details: e.target.value }))}
                  placeholder="List description or notes"
                  rows={3}
                />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEvent(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEvent} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Leads Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Leads</DialogTitle>
            <DialogDescription>
              Upload a CSV file with leads for "{selectedEvent?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Select a CSV file to upload leads
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploadingLeads}
                className="max-w-xs mx-auto"
              />
            </div>
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <Separator />
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Required Fields:</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• First Name</p>
                <p>• Last Name</p>
                <p>• Email</p>
                <p>• Account Name</p>
              </div>
            </div>

            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventManagement;