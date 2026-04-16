import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Get a setting by key
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const key = request.nextUrl.searchParams.get("key")
  
  if (!key) {
    // Get all settings
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ settings: data })
  }
  
  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("key", key)
    .single()
  
  if (error) {
    // Return default if not found
    if (error.code === "PGRST116") {
      return NextResponse.json({ setting: null })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ setting: data })
}

// POST - Update or create a setting
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  try {
    const { key, value } = await request.json()
    
    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 })
    }
    
    // Upsert the setting
    const { data, error } = await supabase
      .from("platform_settings")
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ setting: data })
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
