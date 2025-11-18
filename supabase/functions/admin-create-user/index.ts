
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

    const { email, password, firstName, lastName, department, role } = await req.json()

    // Validate required fields
    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    console.log('Creating user:', { email, firstName, lastName, department, role })

    // Create the user
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        department: department
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      throw createError
    }

    console.log('User created successfully:', newUser.user?.id)

    // Create profile explicitly (don't rely on trigger)
    if (newUser.user) {
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          email: email,
          first_name: firstName || null,
          last_name: lastName || null,
          department: department || null
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Continue - user is created, profile can be fixed later
      }

      // Set the role
      if (role) {
        const { error: roleAssignError } = await supabaseClient
          .from('user_roles')
          .upsert({
            user_id: newUser.user.id,
            role: role
          }, { onConflict: 'user_id' })

        if (roleAssignError) {
          console.error('Error assigning role:', roleAssignError)
          // Don't throw here as the user is already created
        }
      }
    }

    return new Response(
      JSON.stringify({ user: newUser.user }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in admin-create-user:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
