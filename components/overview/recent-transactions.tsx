"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function RecentTransactions() {
  return (
    <Card className="bg-card border-border rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">
          Vendas Recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
      </CardContent>
    </Card>
  )
}
