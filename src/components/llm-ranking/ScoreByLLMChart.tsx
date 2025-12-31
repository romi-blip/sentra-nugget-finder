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
        <CardHeader>
          <CardTitle>Score by LLM Model</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No LLM comparison data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score by LLM Model</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="llm" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                domain={[0, 100]}
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
              />
              <Legend />
              <Bar 
                dataKey="sentra" 
                name="Sentra" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="topVendor" 
                name="Top Vendor" 
                fill="hsl(var(--muted-foreground))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
