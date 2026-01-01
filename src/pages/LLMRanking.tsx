import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw, Loader2 } from 'lucide-react';
import { SentraKPICards } from '@/components/llm-ranking/SentraKPICards';
import { SentraScoreTrendChart } from '@/components/llm-ranking/SentraScoreTrendChart';
import { CompetitiveGapChart } from '@/components/llm-ranking/CompetitiveGapChart';
import { VendorComparisonTable } from '@/components/llm-ranking/VendorComparisonTable';
import { ScoreByLLMChart } from '@/components/llm-ranking/ScoreByLLMChart';
import { AnalysisRunsTable } from '@/components/llm-ranking/AnalysisRunsTable';
import { useLLMRankingAnalytics } from '@/hooks/useLLMRankingAnalytics';

export default function LLMRanking() {
  const {
    competitiveGap,
    vendorComparison,
    vendorByLLM,
    analysisRuns,
    scoreTrends,
    availableCompetitors,
    kpis,
    isLoading,
    refetch,
  } = useLLMRankingAnalytics();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">LLM Ranking Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track Sentra's positioning and performance across LLM recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refetch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Link to="/llm-ranking/settings">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <SentraKPICards
            avgScore={kpis.avgSentraScore}
            avgRank={kpis.avgRank}
            mostCommonPosition={kpis.mostCommonPosition}
            totalAnalyses={kpis.totalAnalyses}
          />
          <SentraScoreTrendChart data={scoreTrends} availableCompetitors={availableCompetitors} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompetitiveGapChart data={competitiveGap} />
            <ScoreByLLMChart data={vendorByLLM} availableCompetitors={availableCompetitors} />
          </div>
          <VendorComparisonTable data={vendorComparison} />
          <AnalysisRunsTable data={analysisRuns} />
        </div>
      )}
    </main>
  );
}
