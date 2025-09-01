
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Play, AlertCircle, Database, Users, FileCheck, Building } from "lucide-react";
import { LeadsService } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";
import { useLeadValidationCounts } from "@/hooks/useLeadValidationCounts";

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
  const { toast } = useToast();
  const { data: validationCounts, refetch: refetchCounts } = useLeadValidationCounts(eventId);

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

  const hasValidLeads = validationCounts && validationCounts.validCount > 0;
  const validationProgress = validationCounts ? 
    Math.round((validationCounts.validCount / (validationCounts.validCount + validationCounts.invalidCount)) * 100) : 0;

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
      status: 'pending',
      canStart: hasValidLeads,
      action: handleCheckSalesforce,
      isLoading: isCheckingSalesforce,
      requiresPrevious: 'validate'
    },
    {
      id: 'enrich',
      title: 'Enrich Data',
      description: 'Add contact details from ZoomInfo',
      icon: <Database className="h-5 w-5" />,
      status: 'pending',
      canStart: false,
      requiresPrevious: 'salesforce'
    },
    {
      id: 'sync',
      title: 'Sync to Salesforce',
      description: 'Create leads/contacts in Salesforce',
      icon: <CheckCircle className="h-5 w-5" />,
      status: 'pending',
      canStart: false,
      requiresPrevious: 'enrich'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string, isLoading?: boolean) => {
    if (isLoading) return <Clock className="h-4 w-4 animate-spin" />;
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-600" />;
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
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="flex-shrink-0">
                {step.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium">{step.title}</h3>
                  <Badge variant="outline" className={getStatusColor(step.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(step.status, step.isLoading)}
                      {step.status}
                    </div>
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                
                {step.progress !== undefined && (
                  <div className="space-y-1">
                    <Progress value={step.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {step.progress}% complete
                    </p>
                  </div>
                )}
                
                {step.stats && (
                  <p className="text-xs text-muted-foreground">{step.stats}</p>
                )}
              </div>
              
              <div className="flex-shrink-0">
                {step.action && (
                  <Button
                    size="sm"
                    onClick={step.action}
                    disabled={!step.canStart || step.isLoading}
                    variant={step.status === 'completed' ? 'outline' : 'default'}
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
