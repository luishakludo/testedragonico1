import { NextRequest, NextResponse } from "next/server"

// GET /api/telegram/get-bot-groups?token=BOT_TOKEN
// Returns groups/channels where the bot is admin
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  try {
    // Use getUpdates to find chats the bot has interacted with
    // First, get any pending updates
    const updatesRes = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=100&allowed_updates=["message","my_chat_member","chat_member"]`
    )
    const updatesData = await updatesRes.json()

    if (!updatesData.ok) {
      return NextResponse.json({ error: updatesData.description || "Failed to get updates" }, { status: 400 })
    }

    // Collect unique chats (groups/supergroups/channels)
    const chatsMap = new Map<string, { id: string; title: string; type: string }>()

    for (const update of updatesData.result || []) {
      // Check message chats
      if (update.message?.chat) {
        const chat = update.message.chat
        if (chat.type === "group" || chat.type === "supergroup" || chat.type === "channel") {
          chatsMap.set(chat.id.toString(), {
            id: chat.id.toString(),
            title: chat.title || "Sem nome",
            type: chat.type,
          })
        }
      }

      // Check my_chat_member updates (when bot is added/removed from groups)
      if (update.my_chat_member?.chat) {
        const chat = update.my_chat_member.chat
        if (chat.type === "group" || chat.type === "supergroup" || chat.type === "channel") {
          // Only include if bot is still a member/admin
          const status = update.my_chat_member.new_chat_member?.status
          if (status === "administrator" || status === "member" || status === "creator") {
            chatsMap.set(chat.id.toString(), {
              id: chat.id.toString(),
              title: chat.title || "Sem nome",
              type: chat.type,
            })
          }
        }
      }
    }

    // For each chat found, verify bot is admin and can invite
    const groups = []
    for (const [chatId, chatInfo] of chatsMap) {
      try {
        // Get bot info
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
        const meData = await meRes.json()
        if (!meData.ok) continue

        // Check bot's status in this chat
        const memberRes = await fetch(
          `https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${meData.result.id}`
        )
        const memberData = await memberRes.json()

        if (memberData.ok) {
          const status = memberData.result.status
          const canInvite = memberData.result.can_invite_users

          groups.push({
            ...chatInfo,
            isAdmin: status === "administrator" || status === "creator",
            canInvite: canInvite === true,
            status,
          })
        }
      } catch {
        // Skip this chat if we can't verify
        continue
      }
    }

    return NextResponse.json({
      success: true,
      groups,
      total: groups.length,
    })
  } catch (error: any) {
    console.error("[get-bot-groups] Error:", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}
