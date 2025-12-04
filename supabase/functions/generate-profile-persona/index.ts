import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { validateAuth } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await validateAuth(req);
    if (!authResult.valid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { profile_id } = await req.json();

    if (!profile_id) {
      return new Response(JSON.stringify({ error: "profile_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating persona for profile: ${profile_id}`);

    // Fetch the profile
    const { data: profile, error: profileError } = await supabase
      .from("reddit_profiles")
      .select("*")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all activity for this profile
    const { data: activities, error: activityError } = await supabase
      .from("reddit_profile_activity")
      .select("*")
      .eq("profile_id", profile_id)
      .order("posted_at", { ascending: false })
      .limit(100);

    if (activityError) {
      console.error("Activity fetch error:", activityError);
    }

    const activityList = activities || [];
    console.log(`Found ${activityList.length} activities for analysis`);

    // Analyze activity patterns
    const subreddits = [...new Set(activityList.map(a => a.subreddit).filter(Boolean))];
    const posts = activityList.filter(a => a.activity_type === "post");
    const comments = activityList.filter(a => a.activity_type === "comment");
    
    // Calculate average content length
    const avgPostLength = posts.length > 0 
      ? Math.round(posts.reduce((sum, p) => sum + (p.content?.length || 0), 0) / posts.length)
      : 0;
    const avgCommentLength = comments.length > 0
      ? Math.round(comments.reduce((sum, c) => sum + (c.content?.length || 0), 0) / comments.length)
      : 0;

    // Prepare activity samples for AI analysis
    const samplePosts = posts.slice(0, 10).map(p => ({
      subreddit: p.subreddit,
      title: p.title,
      content: p.content?.substring(0, 500),
      score: p.score,
    }));

    const sampleComments = comments.slice(0, 20).map(c => ({
      subreddit: c.subreddit,
      content: c.content?.substring(0, 300),
      score: c.score,
    }));

    const systemPrompt = `You are an expert at analyzing Reddit user behavior and creating persona profiles for engagement purposes. 
Analyze the provided Reddit activity and generate a detailed persona profile that captures:
1. Writing style (formal/casual, verbose/concise, technical/accessible)
2. Typical tone (helpful, snarky, critical, enthusiastic, neutral)
3. Expertise areas based on content and subreddits
4. Common phrases or mannerisms
5. Engagement patterns

Return the analysis using the provided tool.`;

    const userPrompt = `Analyze this Reddit user's activity and create a persona profile:

Username: ${profile.reddit_username}
Total Karma: ${profile.total_karma || 0} (${profile.link_karma || 0} post / ${profile.comment_karma || 0} comment)
Account Age: ${profile.account_created_at ? Math.floor((Date.now() - new Date(profile.account_created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 'Unknown'} years
Active Subreddits: ${subreddits.slice(0, 15).join(", ") || "None detected"}

Activity Stats:
- Total Posts: ${posts.length}
- Total Comments: ${comments.length}
- Average Post Length: ${avgPostLength} characters
- Average Comment Length: ${avgCommentLength} characters

Sample Posts:
${JSON.stringify(samplePosts, null, 2)}

Sample Comments:
${JSON.stringify(sampleComments, null, 2)}

Generate a comprehensive persona profile for this user.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_persona",
              description: "Create a persona profile for the Reddit user",
              parameters: {
                type: "object",
                properties: {
                  persona_summary: {
                    type: "string",
                    description: "A 2-3 paragraph narrative summary of the user's persona, how they engage, and what makes their voice distinctive"
                  },
                  writing_style: {
                    type: "string",
                    enum: ["casual", "formal", "technical", "conversational", "snarky", "professional"],
                    description: "Primary writing style"
                  },
                  typical_tone: {
                    type: "string", 
                    enum: ["helpful", "critical", "enthusiastic", "neutral", "sarcastic", "empathetic", "authoritative"],
                    description: "Typical tone when engaging"
                  },
                  expertise_areas: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of 3-7 expertise areas or topics they frequently discuss"
                  },
                  common_phrases: {
                    type: "array",
                    items: { type: "string" },
                    description: "Common phrases or expressions they use"
                  },
                  response_length: {
                    type: "string",
                    enum: ["very_short", "short", "medium", "long", "varies"],
                    description: "Typical response length preference"
                  }
                },
                required: ["persona_summary", "writing_style", "typical_tone", "expertise_areas"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_persona" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI Response:", JSON.stringify(aiData, null, 2));

    // Extract persona from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No persona generated from AI");
    }

    const persona = JSON.parse(toolCall.function.arguments);
    console.log("Generated persona:", persona);

    // Update profile with persona data
    const { error: updateError } = await supabase
      .from("reddit_profiles")
      .update({
        profile_type: "managed",
        persona_summary: persona.persona_summary,
        writing_style: persona.writing_style,
        typical_tone: persona.typical_tone,
        expertise_areas: persona.expertise_areas,
        persona_generated_at: new Date().toISOString(),
      })
      .eq("id", profile_id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    console.log(`Successfully generated persona for profile ${profile_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        persona: {
          persona_summary: persona.persona_summary,
          writing_style: persona.writing_style,
          typical_tone: persona.typical_tone,
          expertise_areas: persona.expertise_areas,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating persona:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate persona" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
