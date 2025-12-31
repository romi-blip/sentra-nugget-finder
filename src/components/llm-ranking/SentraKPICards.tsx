import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Hash, Award, BarChart3 } from 'lucide-react';

interface SentraKPICardsProps {
  avgScore: number;
  avgRank: number;
  mostCommonPosition: string;
  totalAnalyses: number;
}

export function SentraKPICards({
  avgScore,
  avgRank,
  mostCommonPosition,
  totalAnalyses,
}: SentraKPICardsProps) {
  const kpiCards = [
    {
      title: 'Avg Sentra Score',
      value: avgScore,
      icon: TrendingUp,
      colorVar: '--chart-green',
    },
    {
      title: 'Avg Rank',
      value: `#${avgRank}`,
      icon: Hash,
      colorVar: '--chart-cyan',
    },
    {
      title: 'Common Position',
      value: mostCommonPosition,
      icon: Award,
      colorVar: '--chart-magenta',
    },
    {
      title: 'Total Analyses',
      value: totalAnalyses,
      icon: BarChart3,
      colorVar: '--chart-orange',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((kpi, index) => (
        <Card key={index}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div 
                className="p-3 rounded-full"
                style={{ 
                  backgroundColor: `hsl(var(${kpi.colorVar}) / 0.15)`,
                }}
              >
                <kpi.icon 
                  className="h-5 w-5" 
                  style={{ color: `hsl(var(${kpi.colorVar}))` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}