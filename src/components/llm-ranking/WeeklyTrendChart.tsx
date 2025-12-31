import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { WeeklyTrend } from '@/hooks/useLLMRankingAnalytics';
import { format } from 'date-fns';

interface WeeklyTrendChartProps {
  data: WeeklyTrend[];
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
  const chartData = [...data]
    .reverse()
    .map((item) => ({
      ...item,
      week: format(new Date(item.week_start), 'MMM d'),
      sentraScore: Math.round(item.avg_sentra_score || 0),
      topVendorScore: Math.round(item.avg_top_score || 0),
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Sentra Score Over Time</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
          No trend data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Sentra Score Over Time</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.5}
                vertical={false}
              />
              <XAxis 
                dataKey="week" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                dy={8}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
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
                itemStyle={{ fontSize: 12 }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="sentraScore"
                name="Sentra Score"
                stroke="hsl(var(--chart-green))"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--chart-green))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="topVendorScore"
                name="Top Vendor Score"
                stroke="hsl(var(--chart-cyan))"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--chart-cyan))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}