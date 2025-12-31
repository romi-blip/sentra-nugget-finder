import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { CompetitiveGap } from '@/hooks/useLLMRankingAnalytics';

interface CompetitiveGapChartProps {
  data: CompetitiveGap[];
}

const getGapColor = (gap: number) => {
  if (gap <= 0) return 'hsl(142, 76%, 36%)'; // Green - competitive
  if (gap <= 10) return 'hsl(48, 96%, 53%)'; // Yellow - trailing
  return 'hsl(0, 84%, 60%)'; // Red - significant gap
};

export function CompetitiveGapChart({ data }: CompetitiveGapChartProps) {
  const chartData = data
    .slice(0, 8)
    .map((item) => ({
      name: item.vendor_name,
      gap: Math.round(item.score_gap || 0),
      vendorScore: Math.round(item.vendor_avg_score || 0),
      sentraScore: Math.round(item.sentra_avg_score || 0),
      status: item.gap_status,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Competitive Gap Analysis</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No competitive gap data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitive Gap Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                type="number"
                domain={[-20, 30]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                type="category"
                dataKey="name"
                width={100}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'gap') {
                    return [
                      value > 0 ? `+${value} points behind` : `${Math.abs(value)} points ahead`,
                      'Score Gap'
                    ];
                  }
                  return [value, name];
                }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={2} />
              <Bar dataKey="gap" name="gap" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getGapColor(entry.gap)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Competitive (≤0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Trailing (1-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Gap (&gt;10)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
