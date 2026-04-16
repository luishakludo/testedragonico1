import { NextResponse } from "next/server"

// This cron endpoint processes pending campaign sends
// It calls the /api/campaigns/execute endpoint to process users
// whose next_send_at has passed

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const baseUrl = new URL(req.url).origin

    const res = await fetch(`${baseUrl}/api/campaigns/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    const data = await res.json()
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    console.error("[cron/campaigns] Error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
