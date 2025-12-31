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
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Avg Rank',
      value: `#${avgRank}`,
      icon: Hash,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Common Position',
      value: mostCommonPosition,
      icon: Award,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Total Analyses',
      value: totalAnalyses,
      icon: BarChart3,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((kpi, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-full ${kpi.bgColor}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
