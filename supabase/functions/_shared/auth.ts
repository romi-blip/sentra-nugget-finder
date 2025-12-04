import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Validates that the request is authenticated either via:
 * 1. A valid user JWT token
 * 2. The service role key (for internal function-to-function calls)
 * 3. A valid internal secret (for cron jobs)
 */
export async function validateAuth(req: Request): Promise<{ valid: boolean; userId?: string; isServiceRole?: boolean; isScheduled?: boolean }> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return { valid: false };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Check if it's the service role key (internal function-to-function calls)
  if (token === serviceRoleKey) {
    return { valid: true, isServiceRole: true };
  }

  // Check if it's the anon key (scheduled cron jobs)
  if (token === anonKey) {
    return { valid: true, isScheduled: true };
  }

  // Try to validate as user JWT
  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { valid: false };
    }

    return { valid: true, userId: user.id };
  } catch {
    return { valid: false };
  }
}

/**
 * Returns an unauthorized response with CORS headers
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized - valid authentication required' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
