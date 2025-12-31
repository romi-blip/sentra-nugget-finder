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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { prompt_id, prompt_ids, prompt_text, prompt_name, category } = body;

    // Handle multiple prompts
    if (prompt_ids && Array.isArray(prompt_ids) && prompt_ids.length > 0) {
      console.log(`Triggering LLM ranking for ${prompt_ids.length} prompts`);

      const { data: prompts, error: promptsError } = await supabase
        .from("llm_ranking_prompts")
        .select("*")
        .in("id", prompt_ids);

      if (promptsError || !prompts || prompts.length === 0) {
        console.error("Error fetching prompts:", promptsError);
        return new Response(
          JSON.stringify({ error: "Prompts not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload = {
        prompts: prompts.map(p => ({
          prompt_id: p.id,
          prompt_text: p.prompt_text,
          prompt_name: p.name,
          category: p.category,
        })),
        triggered_by: user.id,
        triggered_at: new Date().toISOString(),
        batch: true,
      };

      console.log(`Calling N8N webhook with ${prompts.length} prompts`);
      
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (n8nResponse.ok) {
        const now = new Date().toISOString();
        await supabase
          .from("llm_ranking_prompts")
          .update({ last_run_at: now })
          .in("id", prompt_ids);
      }

      return new Response(
        JSON.stringify({
          success: n8nResponse.ok,
          message: n8nResponse.ok 
            ? `Triggered ${prompts.length} prompts successfully` 
            : "Failed to trigger N8N webhook",
          prompts_count: prompts.length,
        }),
        { status: n8nResponse.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle single prompt
    console.log(`Triggering LLM ranking for prompt: ${prompt_id || 'custom'}`);

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

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promptData),
    });

    if (prompt_id && n8nResponse.ok) {
      await supabase
        .from("llm_ranking_prompts")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", prompt_id);
    }

    return new Response(
      JSON.stringify({
        success: n8nResponse.ok,
        message: n8nResponse.ok ? "LLM ranking triggered successfully" : "Failed to trigger N8N webhook",
      }),
      { status: n8nResponse.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in trigger-llm-ranking:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
