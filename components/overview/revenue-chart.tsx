"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarDays } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const horaData = Array.from({ length: 24 }, (_, i) => ({
  name: `${String(i).padStart(2, "0")}h`,
  vendas: 0,
  valor: 0,
}))

const diaData = Array.from({ length: 30 }, (_, i) => ({
  name: `${i + 1}`,
  vendas: 0,
  valor: 0,
}))

const mesData = [
  { name: "Jan", vendas: 0, valor: 0 },
  { name: "Fev", vendas: 0, valor: 0 },
  { name: "Mar", vendas: 0, valor: 0 },
  { name: "Abr", vendas: 0, valor: 0 },
  { name: "Mai", vendas: 0, valor: 0 },
  { name: "Jun", vendas: 0, valor: 0 },
  { name: "Jul", vendas: 0, valor: 0 },
  { name: "Ago", vendas: 0, valor: 0 },
  { name: "Set", vendas: 0, valor: 0 },
  { name: "Out", vendas: 0, valor: 0 },
  { name: "Nov", vendas: 0, valor: 0 },
  { name: "Dez", vendas: 0, valor: 0 },
]

type Periodo = "hora" | "dia" | "mes"

export function RevenueChart() {
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [dataEspecifica, setDataEspecifica] = useState("")

  const chartData = useMemo(() => {
    if (periodo === "hora") return horaData
    if (periodo === "dia") return diaData
    return mesData
  }, [periodo])

  const formatValor = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <Card className="bg-card border-border rounded-2xl">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-foreground">Vendas</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-secondary p-0.5">
            {(["hora", "dia", "mes"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  periodo === p
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "mes" ? "Mes" : p === "dia" ? "Dia" : "Hora"}
              </button>
            ))}
          </div>
          <div className="relative hidden sm:block">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={dataEspecifica}
              onChange={(e) => setDataEspecifica(e.target.value)}
              className="h-8 w-36 border-border bg-secondary pl-8 text-xs text-foreground rounded-xl"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-52 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(0, 0%, 45%)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(0, 0%, 45%)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 7%)",
                  border: "1px solid hsl(0, 0%, 14%)",
                  borderRadius: "12px",
                  color: "hsl(0, 0%, 95%)",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  name === "valor" ? formatValor(value) : value,
                  name === "valor" ? "Faturado" : "Vendas",
                ]}
              />
              <Area
                type="monotone"
                dataKey="vendas"
                stroke="hsl(160, 60%, 45%)"
                strokeWidth={2}
                fill="url(#salesGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
