import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    // Check if user is super_admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'super_admin') {
      throw new Error('Insufficient permissions')
    }

    console.log('Starting profile backfill process...')

    // Get all users from auth.users (using service role)
    const { data: authUsers, error: authUsersError } = await supabaseClient.auth.admin.listUsers()
    
    if (authUsersError) {
      throw new Error(`Failed to fetch auth users: ${authUsersError.message}`)
    }

    console.log(`Found ${authUsers.users.length} auth users`)

    // Get existing profiles
    const { data: existingProfiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id')

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`)
    }

    const existingProfileIds = new Set(existingProfiles?.map(p => p.id) || [])
    console.log(`Found ${existingProfileIds.size} existing profiles`)

    // Get existing roles
    const { data: existingRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('user_id')

    if (rolesError) {
      throw new Error(`Failed to fetch roles: ${rolesError.message}`)
    }

    const existingRoleIds = new Set(existingRoles?.map(r => r.user_id) || [])
    console.log(`Found ${existingRoleIds.size} existing role assignments`)

    let profilesCreated = 0
    let rolesCreated = 0

    // Create missing profiles and roles
    for (const authUser of authUsers.users) {
      // Create profile if missing
      if (!existingProfileIds.has(authUser.id)) {
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .upsert({
            id: authUser.id,
            email: authUser.email || '',
            first_name: authUser.user_metadata?.first_name || null,
            last_name: authUser.user_metadata?.last_name || null,
            department: authUser.user_metadata?.department || null
          })

        if (profileError) {
          console.error(`Failed to create profile for ${authUser.email}:`, profileError)
        } else {
          profilesCreated++
          console.log(`Created profile for ${authUser.email}`)
        }
      }

      // Create default role if missing
      if (!existingRoleIds.has(authUser.id)) {
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .upsert({
            user_id: authUser.id,
            role: 'user'
          })

        if (roleError) {
          console.error(`Failed to create role for ${authUser.email}:`, roleError)
        } else {
          rolesCreated++
          console.log(`Created role for ${authUser.email}`)
        }
      }
    }

    console.log(`Backfill complete: ${profilesCreated} profiles, ${rolesCreated} roles`)

    return new Response(
      JSON.stringify({ 
        success: true,
        profilesCreated,
        rolesCreated,
        totalUsers: authUsers.users.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in admin-backfill-profiles:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})