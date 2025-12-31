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
import { ArrowUpDown } from 'lucide-react';
import { VendorComparison } from '@/hooks/useLLMRankingAnalytics';

interface VendorComparisonTableProps {
  data: VendorComparison[];
}

type SortKey = keyof VendorComparison;

const positioningColors: Record<string, string> = {
  Leader: 'bg-green-500/10 text-green-500 border-green-500/20',
  Challenger: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  Contender: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  Niche: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  Mentioned: 'bg-muted text-muted-foreground border-muted',
};

export function VendorComparisonTable({ data }: VendorComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('total_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
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
        <CardTitle>Vendor Comparison Matrix</CardTitle>
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
                      {Math.round(vendor.total_score || 0)}
                    </TableCell>
                    <TableCell>{Math.round(vendor.prominence_score || 0)}</TableCell>
                    <TableCell>{Math.round(vendor.sentiment_score || 0)}</TableCell>
                    <TableCell>{Math.round(vendor.capability_depth_score || 0)}</TableCell>
                    <TableCell>{Math.round(vendor.credibility_signals_score || 0)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={positioningColors[vendor.positioning] || positioningColors.Mentioned}
                      >
                        {vendor.positioning || 'N/A'}
                      </Badge>
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
