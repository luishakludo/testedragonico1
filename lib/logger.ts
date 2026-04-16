/**
 * Sistema de Logging para Debug
 * 
 * Todos os logs são salvos no banco de dados para visualização posterior.
 * Acesse /api/debug/logs para ver os logs salvos.
 */

import { getSupabase } from "@/lib/supabase"

export type LogLevel = "info" | "warn" | "error" | "debug"
export type LogCategory = "order_bump" | "payment" | "upsell" | "webhook" | "flow" | "general"

interface LogEntry {
  level: LogLevel
  category: LogCategory
  message: string
  data?: Record<string, unknown>
  telegram_user_id?: number
  bot_id?: string
  flow_id?: string
}

// Logs em memória para acesso rápido (últimos 1000 logs)
const memoryLogs: Array<LogEntry & { timestamp: string; id: number }> = []
let logCounter = 0
const MAX_MEMORY_LOGS = 1000

/**
 * Função principal de logging
 */
export async function log(entry: LogEntry): Promise<void> {
  const timestamp = new Date().toISOString()
  const logId = ++logCounter

  // Log no console (sempre)
  const prefix = `[${entry.category.toUpperCase()}][${entry.level.toUpperCase()}]`
  const consoleMsg = `${prefix} ${entry.message}`
  
  switch (entry.level) {
    case "error":
      console.error(consoleMsg, entry.data || "")
      break
    case "warn":
      console.warn(consoleMsg, entry.data || "")
      break
    default:
      console.log(consoleMsg, entry.data || "")
  }

  // Salvar na memória
  memoryLogs.unshift({ ...entry, timestamp, id: logId })
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.pop()
  }

  // Tentar salvar no banco (não bloqueia se falhar)
  try {
    const supabase = getSupabase()
    await supabase.from("debug_logs").insert({
      level: entry.level,
      category: entry.category,
      message: entry.message,
      data: entry.data || {},
      telegram_user_id: entry.telegram_user_id ? String(entry.telegram_user_id) : null,
      bot_id: entry.bot_id || null,
      flow_id: entry.flow_id || null,
      created_at: timestamp,
    })
  } catch {
    // Ignora erro de banco - o log já está na memória e console
  }
}

/**
 * Helpers para cada categoria
 */
export const orderBumpLog = {
  info: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "info", category: "order_bump", message, data, ...context }),
  warn: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "warn", category: "order_bump", message, data, ...context }),
  error: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "error", category: "order_bump", message, data, ...context }),
  debug: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "debug", category: "order_bump", message, data, ...context }),
}

export const paymentLog = {
  info: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "info", category: "payment", message, data, ...context }),
  warn: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "warn", category: "payment", message, data, ...context }),
  error: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "error", category: "payment", message, data, ...context }),
  debug: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "debug", category: "payment", message, data, ...context }),
}

export const webhookLog = {
  info: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "info", category: "webhook", message, data, ...context }),
  warn: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "warn", category: "webhook", message, data, ...context }),
  error: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "error", category: "webhook", message, data, ...context }),
  debug: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "debug", category: "webhook", message, data, ...context }),
}

export const flowLog = {
  info: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "info", category: "flow", message, data, ...context }),
  warn: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "warn", category: "flow", message, data, ...context }),
  error: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "error", category: "flow", message, data, ...context }),
  debug: (message: string, data?: Record<string, unknown>, context?: { telegram_user_id?: number; bot_id?: string; flow_id?: string }) =>
    log({ level: "debug", category: "flow", message, data, ...context }),
}

/**
 * Retorna os logs da memória (mais recentes primeiro)
 */
export function getMemoryLogs(options?: {
  category?: LogCategory
  level?: LogLevel
  limit?: number
  telegram_user_id?: number
}): Array<LogEntry & { timestamp: string; id: number }> {
  let filtered = memoryLogs

  if (options?.category) {
    filtered = filtered.filter(l => l.category === options.category)
  }
  if (options?.level) {
    filtered = filtered.filter(l => l.level === options.level)
  }
  if (options?.telegram_user_id) {
    filtered = filtered.filter(l => l.telegram_user_id === options.telegram_user_id)
  }
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * Limpa os logs da memória
 */
export function clearMemoryLogs(): void {
  memoryLogs.length = 0
}
