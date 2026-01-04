import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeVendorName } from '@/lib/vendorNormalization';

export interface SentraPerformance {
  analysis_run_id: string;
  sentra_score: number;
  sentra_rank: number;
  sentra_positioning: string;
  total_vendors_mentioned: number;
  llm_provider: string;
  llm_model: string;
  created_at: string;
}

export interface VendorComparison {
  vendor_name_normalized: string;
  total_score: number;
  prominence_score: number;
  sentiment_score: number;
  capability_depth_score: number;
  credibility_signals_score: number;
  positioning: string;
  rank_in_analysis: number;
  created_at: string;
}

export interface CompetitiveGap {
  top_vendor_name: string;
  top_vendor_score: number;
  sentra_score: number;
  score_gap: number;
  competitive_status: string;
}

export interface WeeklyTrend {
  week_start: string;
  avg_sentra_score: number;
  avg_sentra_rank: number;
  analyses_count: number;
  avg_top_score: number;
}

export interface ScoreTrendDataPoint {
  date: string;
  sentra_score: number | null;
  sentra_rank: number | null;
  competitors: Record<string, { score: number | null; rank: number | null }>;
}

export interface VendorByLLM {
  llm_model: string;
  vendor_name_normalized: string;
  avg_score: number;
  analysis_count: number;
}

export interface AnalysisRun {
  id: string;
  query_text: string;
  query_category: string;
  llm_provider: string;
  llm_model: string;
  llm_full_name: string;
  sentra_score: number;
  sentra_rank: number;
  sentra_positioning: string;
  top_vendor_name: string;
  top_vendor_score: number;
  total_vendors_mentioned: number;
  analysis_summary: string;
  analysis_timestamp: string;
  created_at: string;
}

export function useLLMRankingAnalytics() {
  const [sentraPerformance, setSentraPerformance] = useState<SentraPerformance[]>([]);
  const [vendorComparison, setVendorComparison] = useState<VendorComparison[]>([]);
  const [competitiveGap, setCompetitiveGap] = useState<CompetitiveGap[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrend[]>([]);
  const [vendorByLLM, setVendorByLLM] = useState<VendorByLLM[]>([]);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [scoreTrends, setScoreTrends] = useState<ScoreTrendDataPoint[]>([]);
  const [availableCompetitors, setAvailableCompetitors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [
        sentraPerformanceRes,
        vendorComparisonRes,
        competitiveGapRes,
        weeklyTrendsRes,
        vendorByLLMRes,
        analysisRunsRes,
      ] = await Promise.all([
        supabase.from('vw_sentra_performance').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('vw_vendor_comparison').select('*').order('total_score', { ascending: false }),
        supabase.from('vw_sentra_competitive_gap').select('*').order('score_gap', { ascending: false }),
        supabase.from('vw_weekly_trends').select('*').order('week_start', { ascending: false }).limit(12),
        supabase.from('vw_vendor_avg_by_llm').select('*'),
        supabase.from('analysis_runs').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      
      const runs = (analysisRunsRes.data || []) as unknown as AnalysisRun[];
      const runIds = runs.map(r => r.id);
      
      // Fetch vendor scores only for the runs we have
      const vendorScoresRes = runIds.length > 0 
        ? await supabase
            .from('vendor_scores')
            .select('analysis_run_id, vendor_name_normalized, total_score, rank_in_analysis')
            .in('analysis_run_id', runIds)
        : { data: [] as VendorScoreRow[] };

      setSentraPerformance((sentraPerformanceRes.data || []) as unknown as SentraPerformance[]);
      setVendorComparison((vendorComparisonRes.data || []) as unknown as VendorComparison[]);
      setCompetitiveGap((competitiveGapRes.data || []) as unknown as CompetitiveGap[]);
      setWeeklyTrends((weeklyTrendsRes.data || []) as unknown as WeeklyTrend[]);
      setVendorByLLM((vendorByLLMRes.data || []) as unknown as VendorByLLM[]);
      setAnalysisRuns(runs);
      
      // Process score trends with competitor data
      const vendorScores = (vendorScoresRes.data || []) as unknown as VendorScoreRow[];
      const { trends, competitors } = processScoreTrends(runs, vendorScores);
      setScoreTrends(trends);
      setAvailableCompetitors(competitors);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const kpis = {
    avgSentraScore: (() => {
      const validScores = sentraPerformance.filter(p => p.sentra_score != null);
      return validScores.length > 0 
        ? Math.round(validScores.reduce((sum, p) => sum + p.sentra_score, 0) / validScores.length)
        : 0;
    })(),
    avgRank: (() => {
      const validRanks = sentraPerformance.filter(p => p.sentra_rank != null);
      return validRanks.length > 0
        ? Math.round(validRanks.reduce((sum, p) => sum + p.sentra_rank, 0) / validRanks.length * 10) / 10
        : 0;
    })(),
    mostCommonPosition: getMostCommonPosition(sentraPerformance),
    totalAnalyses: analysisRuns.length,
  };

  return { 
    sentraPerformance, 
    vendorComparison, 
    competitiveGap, 
    weeklyTrends, 
    vendorByLLM, 
    analysisRuns, 
    scoreTrends,
    availableCompetitors,
    kpis, 
    isLoading, 
    error, 
    refetch: fetchAnalytics 
  };
}

function getMostCommonPosition(data: SentraPerformance[]): string {
  if (data.length === 0) return 'N/A';
  const counts: Record<string, number> = {};
  data.forEach(item => { if (item.sentra_positioning) counts[item.sentra_positioning] = (counts[item.sentra_positioning] || 0) + 1; });
  let max = 0, result = 'N/A';
  Object.entries(counts).forEach(([pos, count]) => { if (count > max) { max = count; result = pos; } });
  return result;
}

interface VendorScoreRow {
  analysis_run_id: string;
  vendor_name_normalized: string | null;
  total_score: number;
  rank_in_analysis: number | null;
}

function processScoreTrends(
  runs: AnalysisRun[],
  vendorScores: VendorScoreRow[]
): { trends: ScoreTrendDataPoint[]; competitors: string[] } {
  // Group runs by date using created_at (actual scan date)
  const runsByDate: Record<string, AnalysisRun[]> = {};
  const competitorSet = new Set<string>();
  
  // Filter to only include valid runs with created_at and Sentra data
  const validRuns = runs.filter(run => 
    run.created_at && (run.sentra_score != null || run.sentra_rank != null)
  );
  
  validRuns.forEach(run => {
    const date = run.created_at.split('T')[0];
    if (!runsByDate[date]) runsByDate[date] = [];
    runsByDate[date].push(run);
  });

  // Create a map of vendor scores by run ID
  const scoresByRun: Record<string, VendorScoreRow[]> = {};
  vendorScores.forEach(score => {
    if (!scoresByRun[score.analysis_run_id]) scoresByRun[score.analysis_run_id] = [];
    scoresByRun[score.analysis_run_id].push(score);
    if (score.vendor_name_normalized) {
      const normalized = normalizeVendorName(score.vendor_name_normalized);
      if (normalized.toLowerCase() !== 'sentra') {
        competitorSet.add(normalized);
      }
    }
  });

  // Build trend data points
  const trends: ScoreTrendDataPoint[] = Object.entries(runsByDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dateRuns]) => {
      // Average Sentra metrics for the date
      const sentraScores = dateRuns.filter(r => r.sentra_score != null).map(r => r.sentra_score!);
      const sentraRanks = dateRuns.filter(r => r.sentra_rank != null).map(r => r.sentra_rank!);
      
      const avgSentraScore = sentraScores.length > 0 
        ? Math.round(sentraScores.reduce((a, b) => a + b, 0) / sentraScores.length)
        : null;
      const avgSentraRank = sentraRanks.length > 0
        ? Math.round(sentraRanks.reduce((a, b) => a + b, 0) / sentraRanks.length * 10) / 10
        : null;

      // Aggregate competitor scores for this date
      const competitorData: Record<string, { scores: number[]; ranks: number[] }> = {};
      
      dateRuns.forEach(run => {
        const runScores = scoresByRun[run.id] || [];
        runScores.forEach(score => {
          if (!score.vendor_name_normalized) return;
          const name = normalizeVendorName(score.vendor_name_normalized);
          if (name.toLowerCase() === 'sentra') return;
          if (!competitorData[name]) competitorData[name] = { scores: [], ranks: [] };
          if (score.total_score != null) competitorData[name].scores.push(score.total_score);
          if (score.rank_in_analysis != null) competitorData[name].ranks.push(score.rank_in_analysis);
        });
      });

      const competitors: Record<string, { score: number | null; rank: number | null }> = {};
      Object.entries(competitorData).forEach(([name, data]) => {
        competitors[name] = {
          score: data.scores.length > 0 
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : null,
          rank: data.ranks.length > 0
            ? Math.round(data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length * 10) / 10
            : null,
        };
      });

      return {
        date,
        sentra_score: avgSentraScore,
        sentra_rank: avgSentraRank,
        competitors,
      };
    });

  // Sort competitors by frequency of appearance
  const competitorFrequency: Record<string, number> = {};
  trends.forEach(t => {
    Object.keys(t.competitors).forEach(c => {
      competitorFrequency[c] = (competitorFrequency[c] || 0) + 1;
    });
  });

  const sortedCompetitors = Array.from(competitorSet)
    .sort((a, b) => (competitorFrequency[b] || 0) - (competitorFrequency[a] || 0));

  return { trends, competitors: sortedCompetitors };
}
