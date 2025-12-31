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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import { AnalysisRun } from '@/hooks/useLLMRankingAnalytics';
import { format } from 'date-fns';

interface AnalysisRunsTableProps {
  data: AnalysisRun[];
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-[hsl(var(--chart-green))]';
  if (score >= 60) return 'text-[hsl(var(--chart-orange))]';
  return 'text-[hsl(var(--chart-magenta))]';
}

function getRankBadgeVariant(rank: number | null): 'default' | 'secondary' | 'outline' {
  if (rank === null) return 'outline';
  if (rank === 1) return 'default';
  if (rank <= 3) return 'secondary';
  return 'outline';
}

function AnalysisRunRow({ run }: { run: AnalysisRun }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow 
        className="cursor-pointer transition-colors hover:bg-muted/40 border-b border-border/50" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <TableCell className="w-10 py-3">
          <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="p-1 rounded hover:bg-muted transition-colors">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="max-w-[280px] py-3">
          <div className="truncate text-sm font-medium" title={run.query_text || ''}>
            {run.query_text || 'N/A'}
          </div>
        </TableCell>
        <TableCell className="py-3">
          <span className="text-xs text-muted-foreground font-mono">
            {run.llm_model || 'Unknown'}
          </span>
        </TableCell>
        <TableCell className="text-center py-3">
          <span className={`font-bold text-lg ${getScoreColor(run.sentra_score)}`}>
            {run.sentra_score ?? '—'}
          </span>
        </TableCell>
        <TableCell className="text-center py-3">
          <Badge variant={getRankBadgeVariant(run.sentra_rank)} className="font-mono">
            {run.sentra_rank ? `#${run.sentra_rank}` : '—'}
          </Badge>
        </TableCell>
        <TableCell className="py-3">
          {run.top_vendor_name && (
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-[hsl(var(--chart-orange))]" />
              <span className="text-sm">{run.top_vendor_name}</span>
              {run.top_vendor_score && (
                <span className="text-xs text-muted-foreground">
                  ({run.top_vendor_score})
                </span>
              )}
            </div>
          )}
          {!run.top_vendor_name && <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-muted-foreground text-xs py-3">
          {run.analysis_timestamp 
            ? format(new Date(run.analysis_timestamp), 'MMM d, HH:mm')
            : '—'}
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/20 border-b border-border/30">
          <TableCell colSpan={7} className="px-6 py-4">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-medium text-muted-foreground">Query</span>
                <span>{run.query_text || 'N/A'}</span>
              </div>
              {run.analysis_summary && (
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="font-medium text-muted-foreground">Summary</span>
                  <span className="text-muted-foreground">{run.analysis_summary}</span>
                </div>
              )}
              <div className="flex gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Category:</span>
                  <Badge variant="outline" className="text-xs">
                    {run.query_category || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Vendors mentioned:</span>
                  <span className="font-medium">{run.total_vendors_mentioned ?? 'N/A'}</span>
                </div>
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
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Recent Analysis Runs</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          No analysis runs available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Recent Analysis Runs</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10" />
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Query</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">LLM</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">Score</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">Rank</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top Vendor</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 15).map((run) => (
                <AnalysisRunRow key={run.id} run={run} />
              ))}
            </TableBody>
          </Table>
        </div>
        {data.length > 15 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing 15 of {data.length} runs
          </p>
        )}
      </CardContent>
    </Card>
  );
}
