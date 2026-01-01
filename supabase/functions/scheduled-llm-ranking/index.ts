import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_WEBHOOK_URL = "https://sentra.app.n8n.cloud/webhook/63e579fc-8598-4f46-9eb6-bfd6466a661a";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate scheduler secret for cron jobs
    const authHeader = req.headers.get("Authorization");
    const schedulerSecret = Deno.env.get("LLM_RANKING_SCHEDULER_SECRET");
    
    // Allow both scheduler secret and regular JWT auth
    let isSchedulerCall = false;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token === schedulerSecret) {
        isSchedulerCall = true;
        console.log("Authenticated via scheduler secret");
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role for scheduler calls to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isSchedulerCall) {
      // Verify JWT for non-scheduler calls
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader || "" } },
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Authenticated via JWT for user:", user.id);
    }

    // Check if scheduler is enabled globally
    const { data: settings, error: settingsError } = await supabase
      .from("llm_ranking_scheduler_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.error("Error fetching scheduler settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch scheduler settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.scheduler_enabled) {
      console.log("Scheduler is disabled globally, skipping run");
      return new Response(
        JSON.stringify({ success: true, message: "Scheduler is disabled", prompts_triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current time info
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Find prompts that are due to run
    const { data: prompts, error: promptsError } = await supabase
      .from("llm_ranking_prompts")
      .select("*")
      .eq("is_active", true)
      .eq("schedule_enabled", true);

    if (promptsError) {
      console.error("Error fetching prompts:", promptsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch prompts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!prompts || prompts.length === 0) {
      console.log("No scheduled prompts found");
      return new Response(
        JSON.stringify({ success: true, message: "No scheduled prompts found", prompts_triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter prompts that should run today
    const promptsToRun = prompts.filter(prompt => {
      // Check if current day is in schedule_days
      const scheduleDays = prompt.schedule_days || [];
      if (scheduleDays.length > 0 && !scheduleDays.includes(currentDay)) {
        return false;
      }
      
      // Check if next_scheduled_run is due
      if (prompt.next_scheduled_run) {
        const nextRun = new Date(prompt.next_scheduled_run);
        return now >= nextRun;
      }
      
      return true;
    });

    if (promptsToRun.length === 0) {
      console.log("No prompts due to run at this time");
      return new Response(
        JSON.stringify({ success: true, message: "No prompts due to run", prompts_triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${promptsToRun.length} prompts to run`);

    // Prepare payload for N8N
    const payload = {
      prompts: promptsToRun.map(p => ({
        prompt_id: p.id,
        prompt_text: p.prompt_text,
        prompt_name: p.name,
        category: p.category,
      })),
      triggered_by: "scheduler",
      triggered_at: now.toISOString(),
      batch: true,
    };

    // Call N8N webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!n8nResponse.ok) {
      console.error("N8N webhook failed:", await n8nResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to trigger N8N webhook" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_run_at and calculate next_scheduled_run for each prompt
    const promptIds = promptsToRun.map(p => p.id);
    
    for (const prompt of promptsToRun) {
      const nextRun = calculateNextRun(prompt.scheduled_time, prompt.schedule_days);
      
      await supabase
        .from("llm_ranking_prompts")
        .update({ 
          last_run_at: now.toISOString(),
          next_scheduled_run: nextRun?.toISOString() || null
        })
        .eq("id", prompt.id);
    }

    // Update scheduler settings last_run_at
    await supabase
      .from("llm_ranking_scheduler_settings")
      .update({ last_run_at: now.toISOString() })
      .eq("id", settings.id);

    console.log(`Successfully triggered ${promptsToRun.length} prompts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Triggered ${promptsToRun.length} prompts successfully`,
        prompts_triggered: promptsToRun.length,
        prompt_ids: promptIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in scheduled-llm-ranking:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateNextRun(scheduledTime: string | null, scheduleDays: string[] | null): Date | null {
  if (!scheduledTime) return null;
  
  const now = new Date();
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  
  // Start with tomorrow
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(hours, minutes, 0, 0);
  
  // If schedule_days is empty, run every day
  if (!scheduleDays || scheduleDays.length === 0) {
    return next;
  }
  
  // Find next matching day
  for (let i = 0; i < 7; i++) {
    const dayName = next.toLocaleDateString('en-US', { weekday: 'long' });
    if (scheduleDays.includes(dayName)) {
      return next;
    }
    next.setDate(next.getDate() + 1);
  }
  
  return null;
}
