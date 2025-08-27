import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Clock, AlertCircle, Play, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface ProcessingJob {
  id: string
  stage: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_leads: number
  processed_leads: number
  failed_leads: number
  error_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  event_id: string
}

interface StepperProps {
  eventId: string
  onStageComplete?: (stage: string) => void
}

const stages = [
  {
    key: 'validate',
    title: 'Validate List',
    description: 'Clean and validate lead data based on business rules'
  },
  {
    key: 'check_salesforce',
    title: 'Check Salesforce Status',
    description: 'Identify existing accounts and contacts in Salesforce'
  },
  {
    key: 'enrich',
    title: 'Enrich Leads',
    description: 'Add additional data from ZoomInfo'
  },
  {
    key: 'sync',
    title: 'Send to Salesforce',
    description: 'Create/update records in Salesforce'
  }
]

export default function LeadProcessingStepper({ eventId, onStageComplete }: StepperProps) {
  const [jobs, setJobs] = useState<Record<string, ProcessingJob>>({})
  const [currentStage, setCurrentStage] = useState<string>('')

  useEffect(() => {
    fetchJobs()
  }, [eventId])

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_processing_jobs')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const jobsMap: Record<string, ProcessingJob> = {}
      data?.forEach(job => {
        if (!jobsMap[job.stage] || new Date(job.created_at) > new Date(jobsMap[job.stage].created_at)) {
          jobsMap[job.stage] = job as ProcessingJob
        }
      })
      
      setJobs(jobsMap)
    } catch (error) {
      console.error('Error fetching jobs:', error)
      toast.error('Failed to fetch processing status')
    }
  }

  const startStage = async (stage: string) => {
    try {
      setCurrentStage(stage)
      
      const { data, error } = await supabase.functions.invoke(`leads-${stage.replace('_', '-')}`, {
        body: { event_id: eventId }
      })

      if (error) throw error

      toast.success(`${stages.find(s => s.key === stage)?.title} started successfully`)
      
      // Poll for job updates
      const pollInterval = setInterval(async () => {
        await fetchJobs()
        const job = jobs[stage]
        
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          clearInterval(pollInterval)
          setCurrentStage('')
          
          if (job.status === 'completed') {
            onStageComplete?.(stage)
            toast.success(`${stages.find(s => s.key === stage)?.title} completed`)
          } else {
            toast.error(`${stages.find(s => s.key === stage)?.title} failed: ${job.error_message}`)
          }
        }
      }, 2000)
      
    } catch (error) {
      console.error('Error starting stage:', error)
      toast.error(`Failed to start ${stages.find(s => s.key === stage)?.title}`)
      setCurrentStage('')
    }
  }

  const getStageStatus = (stageKey: string): 'pending' | 'processing' | 'completed' | 'failed' => {
    const job = jobs[stageKey]
    return job?.status || 'pending'
  }

  const isStageEnabled = (stageIndex: number): boolean => {
    if (stageIndex === 0) return true // First stage is always enabled
    
    const previousStage = stages[stageIndex - 1]
    return getStageStatus(previousStage.key) === 'completed'
  }

  const getStatusIcon = (status: string, isRunning: boolean) => {
    if (isRunning) return <Loader2 className="h-4 w-4 animate-spin" />
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Lead Processing Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto">
          {stages.map((stage, index) => {
            const status = getStageStatus(stage.key)
            const job = jobs[stage.key]
            const isRunning = currentStage === stage.key
            const enabled = isStageEnabled(index)

            return (
              <div key={stage.key} className="flex items-center">
                <div
                  className={`flex-1 min-w-[280px] p-4 border rounded-lg ${
                    enabled ? 'border-border' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status, isRunning)}
                        <div className="flex-1">
                          <h3 className={`font-medium text-sm ${enabled ? 'text-foreground' : 'text-gray-400'}`}>
                            {stage.title}
                          </h3>
                          <p className={`text-xs ${enabled ? 'text-muted-foreground' : 'text-gray-400'}`}>
                            {stage.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={`text-xs ${getStatusColor(status)}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => startStage(stage.key)}
                          disabled={!enabled || status === 'processing' || isRunning}
                          className="text-xs px-2 py-1 h-7"
                        >
                          {isRunning ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          {status === 'completed' ? 'Re-run' : 'Start'}
                        </Button>
                      </div>

                      {job && (status === 'processing' || status === 'completed' || status === 'failed') && (
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Progress: {job.processed_leads + job.failed_leads} / {job.total_leads}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-600">{job.processed_leads} success</span>
                              <span className="text-red-600">{job.failed_leads} failed</span>
                            </div>
                          </div>
                          {job.total_leads > 0 && (
                            <Progress 
                              value={((job.processed_leads + job.failed_leads) / job.total_leads) * 100} 
                              className="h-1.5"
                            />
                          )}
                          {job.error_message && (
                            <p className="text-xs text-red-600 truncate" title={job.error_message}>
                              {job.error_message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow connector between stages */}
                {index < stages.length - 1 && (
                  <div className="hidden lg:flex items-center px-2">
                    <div className="w-6 h-0.5 bg-border"></div>
                    <div className="w-2 h-2 rotate-45 border-r border-t border-border bg-background ml-1"></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}