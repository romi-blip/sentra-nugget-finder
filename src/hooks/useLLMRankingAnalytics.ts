import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
        supabase.from('analysis_runs').select('*').order('analysis_timestamp', { ascending: false }).limit(50),
      ]);

      setSentraPerformance((sentraPerformanceRes.data || []) as unknown as SentraPerformance[]);
      setVendorComparison((vendorComparisonRes.data || []) as unknown as VendorComparison[]);
      setCompetitiveGap((competitiveGapRes.data || []) as unknown as CompetitiveGap[]);
      setWeeklyTrends((weeklyTrendsRes.data || []) as unknown as WeeklyTrend[]);
      setVendorByLLM((vendorByLLMRes.data || []) as unknown as VendorByLLM[]);
      setAnalysisRuns((analysisRunsRes.data || []) as unknown as AnalysisRun[]);
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
    avgSentraScore: sentraPerformance.length > 0 
      ? Math.round(sentraPerformance.reduce((sum, p) => sum + (p.sentra_score || 0), 0) / sentraPerformance.length)
      : 0,
    avgRank: sentraPerformance.length > 0
      ? Math.round(sentraPerformance.reduce((sum, p) => sum + (p.sentra_rank || 0), 0) / sentraPerformance.length * 10) / 10
      : 0,
    mostCommonPosition: getMostCommonPosition(sentraPerformance),
    totalAnalyses: analysisRuns.length,
  };

  return { sentraPerformance, vendorComparison, competitiveGap, weeklyTrends, vendorByLLM, analysisRuns, kpis, isLoading, error, refetch: fetchAnalytics };
}

function getMostCommonPosition(data: SentraPerformance[]): string {
  if (data.length === 0) return 'N/A';
  const counts: Record<string, number> = {};
  data.forEach(item => { if (item.sentra_positioning) counts[item.sentra_positioning] = (counts[item.sentra_positioning] || 0) + 1; });
  let max = 0, result = 'N/A';
  Object.entries(counts).forEach(([pos, count]) => { if (count > max) { max = count; result = pos; } });
  return result;
}
