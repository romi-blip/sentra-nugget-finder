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
  if (gap <= 0) return 'hsl(var(--chart-green))'; // Green - competitive
  if (gap <= 10) return 'hsl(var(--chart-orange))'; // Orange - trailing
  return 'hsl(var(--chart-magenta))'; // Magenta - significant gap
};

export function CompetitiveGapChart({ data }: CompetitiveGapChartProps) {
  const chartData = data
    .slice(0, 8)
    .map((item) => ({
      name: item.top_vendor_name,
      gap: Math.round(item.score_gap || 0),
      vendorScore: Math.round(item.top_vendor_score || 0),
      sentraScore: Math.round(item.sentra_score || 0),
      status: item.competitive_status,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Competitive Gap Analysis</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
          No competitive gap data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Competitive Gap Analysis</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.5}
                horizontal={false}
              />
              <XAxis 
                type="number"
                domain={[-20, 30]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                type="category"
                dataKey="name"
                width={90}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500, marginBottom: 4 }}
                formatter={(value: number) => {
                  return [
                    value > 0 ? `+${value} points behind` : `${Math.abs(value)} points ahead`,
                    'Score Gap'
                  ];
                }}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              />
              <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} opacity={0.5} />
              <Bar dataKey="gap" name="gap" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getGapColor(entry.gap)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-green))' }} />
            <span className="text-muted-foreground">Competitive (≤0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-orange))' }} />
            <span className="text-muted-foreground">Trailing (1-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-magenta))' }} />
            <span className="text-muted-foreground">Gap (&gt;10)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}