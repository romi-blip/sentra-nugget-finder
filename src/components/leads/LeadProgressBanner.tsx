import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useLeadProcessingJob } from "@/hooks/useLeadProcessingJob";

interface LeadProgressBannerProps {
  eventId: string;
}

export const LeadProgressBanner: React.FC<LeadProgressBannerProps> = ({ eventId }) => {
  const { data: validationJob } = useLeadProcessingJob(eventId, 'validate');
  const { data: salesforceJob } = useLeadProcessingJob(eventId, 'salesforce');
  const { data: enrichmentJob } = useLeadProcessingJob(eventId, 'enrich');

  const activeJob = [enrichmentJob, salesforceJob, validationJob].find(
    job => job?.status === 'running' || job?.status === 'pending'
  );

  const recentJob = [enrichmentJob, salesforceJob, validationJob]
    .filter(job => job?.status === 'completed' || job?.status === 'failed')
    .sort((a, b) => new Date(b?.updated_at || 0).getTime() - new Date(a?.updated_at || 0).getTime())[0];

  const jobToShow = activeJob || recentJob;

  if (!jobToShow) return null;

  const progress = jobToShow.total_leads > 0 
    ? Math.round((jobToShow.processed_leads / jobToShow.total_leads) * 100) 
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'pending':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'validate':
        return 'Email Validation';
      case 'salesforce':
        return 'Salesforce Check';
      case 'enrich':
        return 'Data Enrichment';
      default:
        return stage;
    }
  };

  return (
    <Card className={`${getStatusColor(jobToShow.status)} transition-all duration-300`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(jobToShow.status)}
            <div>
              <h3 className="font-medium text-sm">
                {getStageLabel(jobToShow.stage)} - {jobToShow.status === 'running' ? 'Processing' : 
                 jobToShow.status === 'completed' ? 'Completed' : 
                 jobToShow.status === 'failed' ? 'Failed' : 'Pending'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {jobToShow.processed_leads} of {jobToShow.total_leads} leads processed
                {jobToShow.failed_leads > 0 && ` • ${jobToShow.failed_leads} failed`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={jobToShow.status === 'completed' ? 'secondary' : 
                           jobToShow.status === 'failed' ? 'destructive' : 
                           jobToShow.status === 'running' ? 'default' : 'outline'}>
              {progress}% Complete
            </Badge>
          </div>
        </div>
        
        {jobToShow.status === 'running' && (
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {jobToShow.error_message && (
          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
            {jobToShow.error_message}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadProgressBanner;