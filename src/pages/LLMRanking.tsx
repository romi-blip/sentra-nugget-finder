import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import { WebhookSettingsDialog } from '@/components/settings/WebhookSettingsDialog';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw, Loader2 } from 'lucide-react';
import { SentraKPICards } from '@/components/llm-ranking/SentraKPICards';
import { WeeklyTrendChart } from '@/components/llm-ranking/WeeklyTrendChart';
import { CompetitiveGapChart } from '@/components/llm-ranking/CompetitiveGapChart';
import { VendorComparisonTable } from '@/components/llm-ranking/VendorComparisonTable';
import { ScoreByLLMChart } from '@/components/llm-ranking/ScoreByLLMChart';
import { AnalysisRunsTable } from '@/components/llm-ranking/AnalysisRunsTable';
import { useLLMRankingAnalytics } from '@/hooks/useLLMRankingAnalytics';

export default function LLMRanking() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    weeklyTrends,
    competitiveGap,
    vendorComparison,
    vendorByLLM,
    analysisRuns,
    kpis,
    isLoading,
    refetch,
  } = useLLMRankingAnalytics();

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenSettings={() => setSettingsOpen(true)} />
      <WebhookSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

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
            {/* KPI Cards */}
            <SentraKPICards
              avgScore={kpis.avgSentraScore}
              avgRank={kpis.avgRank}
              mostCommonPosition={kpis.mostCommonPosition}
              totalAnalyses={kpis.totalAnalyses}
            />

            {/* Weekly Trend Chart */}
            <WeeklyTrendChart data={weeklyTrends} />

            {/* Two column charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CompetitiveGapChart data={competitiveGap} />
              <ScoreByLLMChart data={vendorByLLM} />
            </div>

            {/* Vendor Comparison Table */}
            <VendorComparisonTable data={vendorComparison} />

            {/* Recent Analysis Runs */}
            <AnalysisRunsTable data={analysisRuns} />
          </div>
        )}
      </main>
    </div>
  );
}
