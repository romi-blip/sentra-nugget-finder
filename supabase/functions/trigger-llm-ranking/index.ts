import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const N8N_WEBHOOK_URL = "https://sentra.app.n8n.cloud/webhook/63e579fc-8598-4f46-9eb6-bfd6466a661a";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { prompt_id, prompt_text, prompt_name, category } = body;

    console.log(`Triggering LLM ranking for prompt: ${prompt_id || 'custom'}`);

    // If prompt_id is provided, fetch the prompt details
    let promptData = {
      prompt_id,
      prompt_text,
      prompt_name,
      category,
      triggered_by: user.id,
      triggered_at: new Date().toISOString(),
    };

    if (prompt_id) {
      const { data: prompt, error: promptError } = await supabase
        .from("llm_ranking_prompts")
        .select("*")
        .eq("id", prompt_id)
        .single();

      if (promptError) {
        console.error("Error fetching prompt:", promptError);
        return new Response(
          JSON.stringify({ error: "Prompt not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      promptData = {
        prompt_id: prompt.id,
        prompt_text: prompt.prompt_text,
        prompt_name: prompt.name,
        category: prompt.category,
        triggered_by: user.id,
        triggered_at: new Date().toISOString(),
      };
    }

    // Call N8N webhook
    console.log(`Calling N8N webhook with payload:`, JSON.stringify(promptData));
    
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promptData),
    });

    const n8nStatus = n8nResponse.status;
    let n8nResult;
    
    try {
      n8nResult = await n8nResponse.json();
    } catch {
      n8nResult = { status: n8nResponse.ok ? "accepted" : "error" };
    }

    console.log(`N8N response status: ${n8nStatus}`, n8nResult);

    // Update last_run_at if prompt_id was provided
    if (prompt_id && n8nResponse.ok) {
      const { error: updateError } = await supabase
        .from("llm_ranking_prompts")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", prompt_id);

      if (updateError) {
        console.error("Error updating last_run_at:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: n8nResponse.ok,
        message: n8nResponse.ok ? "LLM ranking triggered successfully" : "Failed to trigger N8N webhook",
        n8n_status: n8nStatus,
        n8n_result: n8nResult,
      }),
      { 
        status: n8nResponse.ok ? 200 : 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in trigger-llm-ranking:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
