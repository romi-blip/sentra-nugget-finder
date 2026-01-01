import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Search, TrendingUp, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ScoreTrendDataPoint {
  date: string;
  sentra_score: number | null;
  sentra_rank: number | null;
  competitors: Record<string, { score: number | null; rank: number | null }>;
}

interface SentraScoreTrendChartProps {
  data: ScoreTrendDataPoint[];
  availableCompetitors: string[];
  isLoading?: boolean;
}

const COMPETITOR_COLORS = [
  'hsl(var(--chart-cyan))',
  'hsl(var(--chart-pink))',
  'hsl(220, 70%, 60%)',
  'hsl(45, 85%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(160, 60%, 45%)',
  'hsl(340, 75%, 55%)',
  'hsl(200, 80%, 50%)',
];

const SENTRA_COLOR = 'hsl(var(--chart-green))';

export function SentraScoreTrendChart({
  data,
  availableCompetitors,
  isLoading,
}: SentraScoreTrendChartProps) {
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [metricType, setMetricType] = useState<'score' | 'rank'>('score');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const filteredCompetitors = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return availableCompetitors.filter(c => 
      c.toLowerCase().includes(query)
    );
  }, [availableCompetitors, searchQuery]);

  const chartData = useMemo(() => {
    return [...data].reverse().map(item => {
      const point: Record<string, any> = {
        date: format(new Date(item.date), 'MMM d'),
        fullDate: item.date,
      };
      
      if (metricType === 'score') {
        point.Sentra = item.sentra_score;
        selectedCompetitors.forEach(comp => {
          point[comp] = item.competitors[comp]?.score ?? null;
        });
      } else {
        point.Sentra = item.sentra_rank;
        selectedCompetitors.forEach(comp => {
          point[comp] = item.competitors[comp]?.rank ?? null;
        });
      }
      
      return point;
    });
  }, [data, selectedCompetitors, metricType]);

  const toggleCompetitor = (competitor: string) => {
    setSelectedCompetitors(prev =>
      prev.includes(competitor)
        ? prev.filter(c => c !== competitor)
        : prev.length < 8
          ? [...prev, competitor]
          : prev
    );
  };

  const removeCompetitor = (competitor: string) => {
    setSelectedCompetitors(prev => prev.filter(c => c !== competitor));
  };

  const getCompetitorColor = (index: number) => {
    return COMPETITOR_COLORS[index % COMPETITOR_COLORS.length];
  };

  const formatCompetitorName = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Sentra Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
          No trend data available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sentra Performance Over Time
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Track Sentra's {metricType === 'score' ? 'score' : 'ranking'} and compare with competitors
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs value={metricType} onValueChange={(v) => setMetricType(v as 'score' | 'rank')}>
              <TabsList className="h-8">
                <TabsTrigger value="score" className="text-xs px-3 h-7">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Score
                </TabsTrigger>
                <TabsTrigger value="rank" className="text-xs px-3 h-7">
                  <Hash className="h-3 w-3 mr-1" />
                  Rank
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Competitor
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search competitors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[240px]">
                  <div className="p-2">
                    {filteredCompetitors.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No competitors found
                      </p>
                    ) : (
                      filteredCompetitors.map((competitor) => (
                        <div
                          key={competitor}
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => toggleCompetitor(competitor)}
                        >
                          <Checkbox
                            checked={selectedCompetitors.includes(competitor)}
                            onCheckedChange={() => toggleCompetitor(competitor)}
                          />
                          <span className="text-sm truncate flex-1">
                            {formatCompetitorName(competitor)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {selectedCompetitors.length >= 8 && (
                  <div className="p-2 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      Maximum 8 competitors reached
                    </p>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {selectedCompetitors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge 
              variant="outline" 
              className="text-xs"
              style={{ borderColor: SENTRA_COLOR, color: SENTRA_COLOR }}
            >
              Sentra
            </Badge>
            {selectedCompetitors.map((comp, index) => (
              <Badge
                key={comp}
                variant="outline"
                className="text-xs pr-1 flex items-center gap-1"
                style={{ borderColor: getCompetitorColor(index), color: getCompetitorColor(index) }}
              >
                {formatCompetitorName(comp)}
                <button
                  onClick={() => removeCompetitor(comp)}
                  className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.5}
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                dy={8}
              />
              <YAxis 
                domain={metricType === 'score' ? [0, 100] : ['auto', 'auto']}
                reversed={metricType === 'rank'}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
                label={
                  metricType === 'rank' 
                    ? { value: 'Rank (lower is better)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }
                    : undefined
                }
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
                formatter={(value: number, name: string) => [
                  metricType === 'score' ? `${value}` : `#${value}`,
                  formatCompetitorName(name)
                ]}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => formatCompetitorName(value)}
              />
              
              {/* Sentra line - always shown */}
              <Line
                type="monotone"
                dataKey="Sentra"
                name="Sentra"
                stroke={SENTRA_COLOR}
                strokeWidth={3}
                dot={{ fill: SENTRA_COLOR, strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                connectNulls
              />
              
              {/* Competitor lines */}
              {selectedCompetitors.map((competitor, index) => (
                <Line
                  key={competitor}
                  type="monotone"
                  dataKey={competitor}
                  name={competitor}
                  stroke={getCompetitorColor(index)}
                  strokeWidth={2}
                  dot={{ fill: getCompetitorColor(index), strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  strokeDasharray={index % 2 === 1 ? "5 5" : undefined}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
