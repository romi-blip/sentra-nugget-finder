import React, { useState, useMemo } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';
import { VendorComparison } from '@/hooks/useLLMRankingAnalytics';

interface VendorComparisonTableProps {
  data: VendorComparison[];
}

interface AggregatedVendor {
  vendor_name_normalized: string;
  total_score: number;
  prominence_score: number;
  sentiment_score: number;
  capability_depth_score: number;
  credibility_signals_score: number;
  positioning: string;
  analysis_count: number;
}

type SortKey = keyof AggregatedVendor;

const positioningColors: Record<string, string> = {
  Leader: 'bg-green-500/10 text-green-500 border-green-500/20',
  Challenger: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Contender: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  Niche: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Mentioned: 'bg-muted text-muted-foreground border-muted',
};

const timeFrameOptions = [
  { value: 'all', label: 'All Time' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
];

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getMostCommon(arr: string[]): string {
  if (arr.length === 0) return 'N/A';
  const counts: Record<string, number> = {};
  arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
  let max = 0, result = 'N/A';
  Object.entries(counts).forEach(([val, count]) => {
    if (count > max) { max = count; result = val; }
  });
  return result;
}

export function VendorComparisonTable({ data }: VendorComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [timeFrame, setTimeFrame] = useState<string>('all');

  // Filter data by time frame
  const filteredByTime = useMemo(() => {
    if (timeFrame === 'all') return data;
    
    const days = parseInt(timeFrame);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return data.filter(item => {
      if (!item.created_at) return true;
      return new Date(item.created_at) >= cutoffDate;
    });
  }, [data, timeFrame]);

  // Aggregate vendors by name
  const aggregatedData = useMemo(() => {
    const vendorMap = new Map<string, {
      total_scores: number[];
      prominence_scores: number[];
      sentiment_scores: number[];
      capability_scores: number[];
      credibility_scores: number[];
      positions: string[];
    }>();

    filteredByTime.forEach(item => {
      const name = item.vendor_name_normalized;
      if (!name) return;
      
      if (!vendorMap.has(name)) {
        vendorMap.set(name, {
          total_scores: [],
          prominence_scores: [],
          sentiment_scores: [],
          capability_scores: [],
          credibility_scores: [],
          positions: [],
        });
      }
      
      const entry = vendorMap.get(name)!;
      if (item.total_score != null) entry.total_scores.push(item.total_score);
      if (item.prominence_score != null) entry.prominence_scores.push(item.prominence_score);
      if (item.sentiment_score != null) entry.sentiment_scores.push(item.sentiment_score);
      if (item.capability_depth_score != null) entry.capability_scores.push(item.capability_depth_score);
      if (item.credibility_signals_score != null) entry.credibility_scores.push(item.credibility_signals_score);
      if (item.positioning) entry.positions.push(item.positioning);
    });

    return Array.from(vendorMap.entries()).map(([name, stats]): AggregatedVendor => ({
      vendor_name_normalized: name,
      total_score: Math.round(avg(stats.total_scores)),
      prominence_score: Math.round(avg(stats.prominence_scores)),
      sentiment_score: Math.round(avg(stats.sentiment_scores)),
      capability_depth_score: Math.round(avg(stats.capability_scores)),
      credibility_signals_score: Math.round(avg(stats.credibility_scores)),
      positioning: getMostCommon(stats.positions),
      analysis_count: stats.total_scores.length,
    }));
  }, [filteredByTime]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedData = [...aggregatedData].sort((a, b) => {
    const aValue = a[sortKey] ?? 0;
    const bValue = b[sortKey] ?? 0;
    const comparison = typeof aValue === 'string' 
      ? aValue.localeCompare(bValue as string)
      : (aValue as number) - (bValue as number);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const SortButton = ({ columnKey, label }: { columnKey: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(columnKey)}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendor Comparison Matrix</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No vendor comparison data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Vendor Comparison Matrix</CardTitle>
          <Select value={timeFrame} onValueChange={setTimeFrame}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeFrameOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead><SortButton columnKey="total_score" label="Score" /></TableHead>
                <TableHead><SortButton columnKey="prominence_score" label="Prominence" /></TableHead>
                <TableHead><SortButton columnKey="sentiment_score" label="Sentiment" /></TableHead>
                <TableHead><SortButton columnKey="capability_depth_score" label="Capability" /></TableHead>
                <TableHead><SortButton columnKey="credibility_signals_score" label="Credibility" /></TableHead>
                <TableHead>Position</TableHead>
                <TableHead><SortButton columnKey="analysis_count" label="Analyses" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.slice(0, 15).map((vendor, index) => {
                const isSentra = vendor.vendor_name_normalized?.toLowerCase().includes('sentra');
                return (
                  <TableRow 
                    key={vendor.vendor_name_normalized} 
                    className={isSentra ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {isSentra ? (
                        <span className="flex items-center gap-2">
                          {vendor.vendor_name_normalized}
                          <Badge variant="outline" className="text-xs">You</Badge>
                        </span>
                      ) : (
                        vendor.vendor_name_normalized
                      )}
                    </TableCell>
                    <TableCell className="font-bold">
                      {vendor.total_score}
                    </TableCell>
                    <TableCell>{vendor.prominence_score}</TableCell>
                    <TableCell>{vendor.sentiment_score}</TableCell>
                    <TableCell>{vendor.capability_depth_score}</TableCell>
                    <TableCell>{vendor.credibility_signals_score}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={positioningColors[vendor.positioning] || positioningColors.Mentioned}
                      >
                        {vendor.positioning || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.analysis_count}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
