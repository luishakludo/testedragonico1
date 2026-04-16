import { NextResponse } from "next/server"

// Simple ping endpoint to keep the serverless function warm
// Set up a cron job (e.g., cron-job.org) to hit this every 5 minutes
// GET /api/telegram/ping

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    message: "Webhook endpoint is warm"
  })
}
