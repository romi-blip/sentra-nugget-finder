import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AnalysisRun } from '@/hooks/useLLMRankingAnalytics';
import { format } from 'date-fns';

interface AnalysisRunsTableProps {
  data: AnalysisRun[];
}

function AnalysisRunRow({ run }: { run: AnalysisRun }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setIsOpen(!isOpen)}>
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="max-w-[300px]">
          <div className="truncate" title={run.query_text || ''}>
            {run.query_text || 'N/A'}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="font-mono text-xs">
            {run.llm_full_name || `${run.llm_provider} ${run.llm_model}`}
          </Badge>
        </TableCell>
        <TableCell className="text-center font-bold">
          {run.sentra_score ?? 'N/A'}
        </TableCell>
        <TableCell className="text-center">
          #{run.sentra_rank ?? 'N/A'}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">
            {run.sentra_positioning || 'N/A'}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="text-muted-foreground">{run.top_vendor_name || 'N/A'}</span>
          {run.top_vendor_score && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({run.top_vendor_score})
            </span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {run.analysis_timestamp 
            ? format(new Date(run.analysis_timestamp), 'MMM d, HH:mm')
            : 'N/A'}
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30">
          <TableCell colSpan={8} className="p-4">
            <div className="space-y-2">
              <div>
                <span className="font-medium text-sm">Query: </span>
                <span className="text-sm text-muted-foreground">{run.query_text}</span>
              </div>
              {run.analysis_summary && (
                <div>
                  <span className="font-medium text-sm">Summary: </span>
                  <span className="text-sm text-muted-foreground">{run.analysis_summary}</span>
                </div>
              )}
              <div className="flex gap-4 text-sm">
                <span>
                  <span className="font-medium">Category:</span>{' '}
                  <span className="text-muted-foreground">{run.query_category || 'N/A'}</span>
                </span>
                <span>
                  <span className="font-medium">Total Vendors:</span>{' '}
                  <span className="text-muted-foreground">{run.total_vendors_mentioned ?? 'N/A'}</span>
                </span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AnalysisRunsTable({ data }: AnalysisRunsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Analysis Runs</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          No analysis runs available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Analysis Runs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Query</TableHead>
                <TableHead>LLM</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Rank</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Top Vendor</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 20).map((run) => (
                <AnalysisRunRow key={run.id} run={run} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
