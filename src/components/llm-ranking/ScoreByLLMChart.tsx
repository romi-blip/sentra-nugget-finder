import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Search, X } from 'lucide-react';
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
  availableCompetitors: string[];
}

const COMPETITOR_COLORS = [
  'hsl(var(--chart-orange))',
  'hsl(var(--chart-cyan))',
  'hsl(var(--chart-yellow))',
  'hsl(var(--chart-green))',
  'hsl(var(--chart-blue))',
  'hsl(var(--chart-purple))',
  'hsl(var(--chart-red))',
  'hsl(var(--chart-pink))',
];

export function ScoreByLLMChart({ data, availableCompetitors }: ScoreByLLMChartProps) {
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Get unique LLM models from data
  const llmModels = useMemo(() => {
    const models = new Set<string>();
    data.forEach(item => {
      if (item.llm_model) models.add(item.llm_model);
    });
    return Array.from(models);
  }, [data]);

  // Build chart data with Sentra and selected competitors per LLM
  const chartData = useMemo(() => {
    return llmModels.map(llm => {
      const llmData: Record<string, any> = { llm: formatLLMLabel(llm) };
      
      // Get Sentra score for this LLM
      const sentraEntry = data.find(
        d => d.llm_model === llm && d.vendor_name_normalized?.toLowerCase().includes('sentra')
      );
      llmData.sentra = Math.round(sentraEntry?.avg_score || 0);

      // Get scores for selected competitors
      selectedCompetitors.forEach(competitor => {
        const competitorEntry = data.find(
          d => d.llm_model === llm && d.vendor_name_normalized === competitor
        );
        llmData[competitor] = Math.round(competitorEntry?.avg_score || 0);
      });

      return llmData;
    });
  }, [data, llmModels, selectedCompetitors]);

  // Filter competitors for the search
  const filteredCompetitors = useMemo(() => {
    const uniqueCompetitors = new Set<string>();
    data.forEach(item => {
      if (item.vendor_name_normalized && !item.vendor_name_normalized.toLowerCase().includes('sentra')) {
        uniqueCompetitors.add(item.vendor_name_normalized);
      }
    });
    
    // Merge with availableCompetitors prop
    availableCompetitors.forEach(c => uniqueCompetitors.add(c));
    
    return Array.from(uniqueCompetitors)
      .filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [data, availableCompetitors, searchQuery]);

  const toggleCompetitor = (competitor: string) => {
    setSelectedCompetitors(prev => 
      prev.includes(competitor)
        ? prev.filter(c => c !== competitor)
        : prev.length < 8 ? [...prev, competitor] : prev
    );
  };

  const removeCompetitor = (competitor: string) => {
    setSelectedCompetitors(prev => prev.filter(c => c !== competitor));
  };

  const formatCompetitorName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Score by LLM Model</CardTitle>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Competitor
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search competitors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredCompetitors.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No competitors found</p>
                  ) : (
                    filteredCompetitors.map(competitor => (
                      <div
                        key={competitor}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                        onClick={() => toggleCompetitor(competitor)}
                      >
                        <Checkbox
                          checked={selectedCompetitors.includes(competitor)}
                          className="pointer-events-none"
                        />
                        <span className="text-sm truncate flex-1">
                          {formatCompetitorName(competitor)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {selectedCompetitors.length >= 8 && (
                  <p className="text-xs text-muted-foreground text-center">Maximum 8 competitors</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Selected competitors badges */}
        {selectedCompetitors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="secondary" className="bg-[hsl(var(--chart-magenta))] text-white">
              Sentra
            </Badge>
            {selectedCompetitors.map((competitor, index) => (
              <Badge
                key={competitor}
                variant="secondary"
                className="flex items-center gap-1 text-white"
                style={{ backgroundColor: COMPETITOR_COLORS[index % COMPETITOR_COLORS.length] }}
              >
                {formatCompetitorName(competitor)}
                <X
                  className="h-3 w-3 cursor-pointer hover:opacity-70"
                  onClick={() => removeCompetitor(competitor)}
                />
              </Badge>
            ))}
          </div>
        )}
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
              {selectedCompetitors.map((competitor, index) => (
                <Bar
                  key={competitor}
                  dataKey={competitor}
                  name={formatCompetitorName(competitor)}
                  fill={COMPETITOR_COLORS[index % COMPETITOR_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function formatLLMLabel(llmModel: string): string {
  const labelMap: Record<string, string> = {
    'gpt-4': 'GPT-4',
    'gpt-4o': 'GPT-4o',
    'gpt-5.1': 'GPT-5.1',
    'claude-3': 'Claude 3',
    'claude-3.5': 'Claude 3.5',
    'claude-4': 'Claude 4',
    'claude-opus-4.5': 'Claude Opus 4.5',
    'gemini-pro': 'Gemini Pro',
    'gemini-1.5': 'Gemini 1.5',
    'gemini-2': 'Gemini 2',
    'gemini-3-pro-preview': 'Gemini 3 Pro',
    'perplexity-sonar': 'Perplexity Sonar',
  };
  
  return labelMap[llmModel.toLowerCase()] || llmModel;
}
