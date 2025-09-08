import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Play, AlertCircle, Database, Users, FileCheck, Building, UserPlus, ExternalLink } from "lucide-react";
import { LeadsService } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";
import { useLeadValidationCounts } from "@/hooks/useLeadValidationCounts";
import { useLeadProcessingJob } from "@/hooks/useLeadProcessingJob";

interface LeadProcessingStepperProps {
  eventId: string;
  onStageComplete?: (stage: string) => void;
}

const LeadProcessingStepper: React.FC<LeadProcessingStepperProps> = ({ 
  eventId, 
  onStageComplete 
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [isCheckingSalesforce, setIsCheckingSalesforce] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { data: validationCounts, refetch: refetchCounts } = useLeadValidationCounts(eventId);
  const { data: salesforceJob } = useLeadProcessingJob(eventId, 'check_salesforce');
  const { data: enrichmentJob } = useLeadProcessingJob(eventId, 'enrich');
  const { data: syncJob } = useLeadProcessingJob(eventId, 'sync');

  const handleValidateEmails = async () => {
    setIsValidating(true);
    try {
      const result = await LeadsService.validateEmails(eventId);
      if (result.success) {
        toast({
          title: "Email Validation Started",
          description: result.message,
        });
        setTimeout(() => {
          refetchCounts();
          onStageComplete?.('validate');
        }, 2000);
      } else {
        toast({
          title: "Validation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to start email validation",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleCheckSalesforce = async () => {
    if (!validationCounts?.validCount || validationCounts.validCount === 0) {
      toast({
        title: "No Valid Leads",
        description: "Please validate emails first before checking Salesforce status",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingSalesforce(true);
    try {
      const result = await LeadsService.checkSalesforceStatus(eventId);
      if (result.success) {
        toast({
          title: "Salesforce Check Started",
          description: result.message,
        });
        setTimeout(() => {
          onStageComplete?.('salesforce');
        }, 2000);
      } else {
        toast({
          title: "Salesforce Check Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Salesforce Error",
        description: "Failed to start Salesforce status check",
        variant: "destructive",
      });
    } finally {
      setIsCheckingSalesforce(false);
    }
  };

  const handleEnrichLeads = async () => {
    if (!hasSalesforceCompleted) {
      toast({
        title: "Prerequisite not met",
        description: "Please complete Salesforce check first to proceed with enrichment.",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const result = await LeadsService.enrichLeads(eventId);
      if (result.success) {
        toast({
          title: "Lead Enrichment Started",
          description: result.message,
        });
        setTimeout(() => {
          onStageComplete?.('enrich');
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Lead enrichment error:', error);
      toast({
        title: "Error",
        description: "Failed to start lead enrichment",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSyncToSalesforce = async () => {
    if (!hasEnrichmentCompleted) {
      toast({
        title: "Prerequisite not met",
        description: "Please complete lead enrichment first to proceed with Salesforce sync.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const response = await LeadsService.syncToSalesforce(eventId);
      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        onStageComplete?.('sync');
      } else {
        toast({
          title: "Error",
          description: response.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to sync to Salesforce:', error);
      toast({
        title: "Error",
        description: "Failed to start Salesforce sync",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const hasValidLeads = validationCounts && validationCounts.validCount > 0;
  const hasSalesforceCompleted = salesforceJob?.status === 'completed';
  const hasEnrichmentCompleted = enrichmentJob?.status === 'completed';
  const validationProgress = validationCounts ? 
    Math.round((validationCounts.validCount / (validationCounts.validCount + validationCounts.invalidCount)) * 100) : 0;

  // Derive Salesforce step status from job data
  const getSalesforceStepStatus = () => {
    if (!salesforceJob) return 'pending';
    
    switch (salesforceJob.status) {
      case 'completed': return 'completed';
      case 'running': return 'in-progress';
      case 'processing': return 'in-progress';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  };

  const getSalesforceProgress = () => {
    if (!salesforceJob || salesforceJob.total_leads === 0) return undefined;
    return Math.round((salesforceJob.processed_leads / salesforceJob.total_leads) * 100);
  };

  const getSalesforceStats = () => {
    if (!salesforceJob) return undefined;
    if (salesforceJob.status === 'completed') {
      return `${salesforceJob.processed_leads} processed, ${salesforceJob.failed_leads} failed`;
    }
    if (salesforceJob.status === 'running') {
      return `${salesforceJob.processed_leads}/${salesforceJob.total_leads} processed`;
    }
    return undefined;
  };

  // Derive Enrichment step status from job data
  const getEnrichmentStepStatus = () => {
    if (!enrichmentJob) return 'pending';
    
    switch (enrichmentJob.status) {
      case 'completed': return 'completed';
      case 'running': return 'in-progress';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  };

  const getEnrichmentProgress = () => {
    if (!enrichmentJob || enrichmentJob.total_leads === 0) return undefined;
    return Math.round((enrichmentJob.processed_leads / enrichmentJob.total_leads) * 100);
  };

  const getEnrichmentStats = () => {
    if (!enrichmentJob) return undefined;
    if (enrichmentJob.status === 'completed') {
      return `${enrichmentJob.processed_leads} enriched, ${enrichmentJob.failed_leads} failed`;
    }
    if (enrichmentJob.status === 'running') {
      return `${enrichmentJob.processed_leads}/${enrichmentJob.total_leads} processed`;
    }
    return undefined;
  };

  // Derive Sync step status from job data
  const getSyncStepStatus = () => {
    if (!syncJob) return 'pending';
    
    switch (syncJob.status) {
      case 'completed': return 'completed';
      case 'processing': return 'in-progress';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  };

  const getSyncProgress = () => {
    if (!syncJob || syncJob.total_leads === 0) return undefined;
    return Math.round((syncJob.processed_leads / syncJob.total_leads) * 100);
  };

  const getSyncStats = () => {
    if (!syncJob) return undefined;
    if (syncJob.status === 'completed') {
      return `${syncJob.processed_leads} synced, ${syncJob.failed_leads} failed`;
    }
    if (syncJob.status === 'processing') {
      return `${syncJob.processed_leads}/${syncJob.total_leads} processed`;
    }
    return undefined;
  };

  const steps = [
    {
      id: 'upload',
      title: 'Upload Leads',
      description: 'Import leads from CSV file',
      icon: <FileCheck className="h-5 w-5" />,
      status: 'completed',
      canStart: true
    },
    {
      id: 'validate',
      title: 'Validate Emails',
      description: 'Check email deliverability',
      icon: <Users className="h-5 w-5" />,
      status: hasValidLeads ? 'completed' : validationCounts?.invalidCount > 0 ? 'in-progress' : 'pending',
      canStart: true,
      action: handleValidateEmails,
      isLoading: isValidating,
      progress: validationProgress,
      stats: validationCounts ? `${validationCounts.validCount} valid, ${validationCounts.invalidCount} invalid` : undefined
    },
    {
      id: 'salesforce',
      title: 'Check Salesforce',
      description: 'Verify existing accounts and contacts',
      icon: <Building className="h-5 w-5" />,
      status: getSalesforceStepStatus(),
      canStart: hasValidLeads,
      action: handleCheckSalesforce,
      isLoading: isCheckingSalesforce || salesforceJob?.status === 'running' || salesforceJob?.status === 'processing',
      progress: getSalesforceProgress(),
      stats: getSalesforceStats(),
      requiresPrevious: 'validate'
    },
    {
      id: 'enrich',
      title: 'Enrich Data',
      description: 'Add additional contact information from ZoomInfo',
      icon: <UserPlus className="h-5 w-5" />,
      status: getEnrichmentStepStatus(),
      canStart: hasSalesforceCompleted,
      action: handleEnrichLeads,
      isLoading: isEnriching,
      progress: getEnrichmentProgress(),
      stats: getEnrichmentStats(),
      requiresPrevious: 'salesforce'
    },
    {
      id: 'sync',
      title: 'Sync to Salesforce',
      description: 'Push qualified leads to Salesforce CRM',
      icon: <Database className="h-5 w-5" />,
      status: getSyncStepStatus(),
      canStart: hasEnrichmentCompleted,
      action: handleSyncToSalesforce,
      isLoading: isSyncing || syncJob?.status === 'processing',
      progress: getSyncProgress(),
      stats: getSyncStats(),
      requiresPrevious: 'enrich'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string, isLoading?: boolean) => {
    if (isLoading) return <Clock className="h-4 w-4 animate-spin" />;
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lead Processing Pipeline
        </CardTitle>
        <CardDescription>
          Process your leads through validation, Salesforce checking, enrichment, and sync
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col p-4 border rounded-lg h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-shrink-0">
                  {step.icon}
                </div>
                <Badge variant="outline" className={getStatusColor(step.status)}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(step.status, step.isLoading)}
                    <span className="text-xs">{step.status}</span>
                  </div>
                </Badge>
              </div>
              
              <div className="flex-1">
                <h3 className="text-sm font-medium mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
                
                {step.progress !== undefined && (
                  <div className="space-y-1 mb-3">
                    <Progress value={step.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {step.progress}% complete
                    </p>
                  </div>
                )}
                
                 {step.stats && (
                   <p className="text-xs text-muted-foreground mb-3">{step.stats}</p>
                 )}
                 
                 {step.id === 'enrich' && enrichmentJob?.status === 'failed' && (
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => window.open('https://supabase.com/dashboard/project/gmgrlphiopslkyxmuced/functions/leads-enrich/logs', '_blank')}
                     className="w-full mb-2"
                   >
                     <ExternalLink className="h-4 w-4 mr-2" />
                     View Logs
                   </Button>
                 )}

                 {step.id === 'sync' && syncJob?.status === 'failed' && (
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => window.open('https://supabase.com/dashboard/project/gmgrlphiopslkyxmuced/functions/leads-sync-salesforce/logs', '_blank')}
                     className="w-full mb-2"
                   >
                     <ExternalLink className="h-4 w-4 mr-2" />
                     View Logs
                   </Button>
                 )}
              </div>
              
              <div className="mt-auto">
                {step.action && (
                  <Button
                    size="sm"
                    onClick={step.action}
                    disabled={!step.canStart || step.isLoading}
                    variant={step.status === 'completed' ? 'outline' : 'default'}
                    className="w-full"
                  >
                    {step.isLoading ? (
                      <Clock className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {step.status === 'completed' ? 'Restart' : 'Start'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadProcessingStepper;