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
  Legend,
} from 'recharts';
import { VendorByLLM } from '@/hooks/useLLMRankingAnalytics';

interface ScoreByLLMChartProps {
  data: VendorByLLM[];
}

export function ScoreByLLMChart({ data }: ScoreByLLMChartProps) {
  // Transform data: group by LLM and show Sentra vs top vendors
  const llmGroups = data.reduce((acc, item) => {
    const llmKey = item.llm_model;
    if (!acc[llmKey]) {
      acc[llmKey] = { llm: llmKey, sentra: 0, topVendor: 0 };
    }
    
    if (item.vendor_name_normalized?.toLowerCase().includes('sentra')) {
      acc[llmKey].sentra = Math.round(item.avg_score || 0);
    } else if (item.avg_score > acc[llmKey].topVendor) {
      acc[llmKey].topVendor = Math.round(item.avg_score || 0);
    }
    
    return acc;
  }, {} as Record<string, { llm: string; sentra: number; topVendor: number }>);

  const chartData = Object.values(llmGroups)
    .filter(item => item.sentra > 0 || item.topVendor > 0)
    .slice(0, 6);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Score by LLM Model</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
          No LLM comparison data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Score by LLM Model</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.5}
                vertical={false}
              />
              <XAxis 
                dataKey="llm" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                angle={-20}
                textAnchor="end"
                height={50}
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
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar 
                dataKey="sentra" 
                name="Sentra" 
                fill="hsl(var(--chart-magenta))" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar 
                dataKey="topVendor" 
                name="Top Vendor" 
                fill="hsl(var(--chart-orange))" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}