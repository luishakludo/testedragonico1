import { NextResponse } from "next/server"

// GET /api
// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: "Dragon online",
    timestamp: new Date().toISOString()
  })
}
