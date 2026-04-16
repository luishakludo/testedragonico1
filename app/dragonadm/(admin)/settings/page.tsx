"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Settings, Shield, Bell, Database, Lock, CheckCircle, Sparkles } from "lucide-react"

export default function SettingsPage() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(149, 228, 104, 0.2), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(149, 228, 104, 0.2)'
              }}
            >
              <Settings className="w-5 h-5 text-[#95e468]" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Configuracoes</h1>
          </div>
          <p className="text-[#666666] text-sm">
            Configuracoes gerais do painel administrativo
          </p>
        </div>

        {/* Settings Cards */}
        <div className="space-y-6">
          {/* Security Card */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ 
              background: '#0f0f0f',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div 
              className="px-6 py-5 flex items-center gap-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59, 130, 246, 0.1)' }}
              >
                <Shield className="w-6 h-6 text-[#3b82f6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Seguranca</h2>
                <p className="text-sm text-[#666666]">Configuracoes de acesso ao painel</p>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Email do Admin</label>
                <Input 
                  value="admin@dragon.com" 
                  disabled 
                  className="bg-[#111111] border-[rgba(255,255,255,0.06)] text-[#666666] h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
                  <Input 
                    type="password" 
                    placeholder="Digite a nova senha" 
                    className="bg-[#111111] border-[rgba(255,255,255,0.06)] text-white placeholder:text-[#444444] h-12 rounded-xl pl-11"
                  />
                </div>
              </div>
              <button 
                className="px-6 py-3 rounded-xl text-sm font-semibold text-[#050505] transition-all duration-200 hover:-translate-y-0.5"
                style={{ 
                  background: 'linear-gradient(135deg, #95e468, #7bc752)',
                  boxShadow: '0 0 20px rgba(149, 228, 104, 0.3)'
                }}
              >
                Atualizar Senha
              </button>
            </div>
          </div>

          {/* Notifications Card */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ 
              background: '#0f0f0f',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div 
              className="px-6 py-5 flex items-center gap-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.1)' }}
              >
                <Bell className="w-6 h-6 text-[#f59e0b]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Notificacoes</h2>
                <p className="text-sm text-[#666666]">Configurar alertas e notificacoes</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <Bell className="h-8 w-8 text-[#444444]" />
                </div>
                <h3 className="text-base font-medium text-[#666666] mb-2">Em Desenvolvimento</h3>
                <p className="text-sm text-[#444444] max-w-sm">
                  Configuracoes de notificacoes estarao disponiveis em breve
                </p>
              </div>
            </div>
          </div>

          {/* System Card */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ 
              background: '#0f0f0f',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div 
              className="px-6 py-5 flex items-center gap-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139, 92, 246, 0.1)' }}
              >
                <Database className="w-6 h-6 text-[#8b5cf6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Sistema</h2>
                <p className="text-sm text-[#666666]">Informacoes do sistema</p>
              </div>
            </div>
            <div className="p-6 space-y-0">
              {[
                { label: "Versao", value: "1.0.0", isStatus: false },
                { label: "Ambiente", value: "Production", isStatus: false },
                { label: "Database", value: "Connected", isStatus: true, statusColor: "#22c55e" },
              ].map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between py-4"
                  style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <span className="text-sm text-[#666666]">{item.label}</span>
                  {item.isStatus ? (
                    <span 
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ 
                        background: 'rgba(34, 197, 94, 0.1)',
                        color: item.statusColor,
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                      }}
                    >
                      <CheckCircle className="w-3 h-3" />
                      {item.value}
                    </span>
                  ) : (
                    <span className="text-sm font-mono text-white">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Brand Info */}
          <div 
            className="rounded-2xl p-6 text-center"
            style={{ 
              background: 'linear-gradient(145deg, rgba(149, 228, 104, 0.05), rgba(139, 92, 246, 0.03))',
              border: '1px solid rgba(149, 228, 104, 0.1)'
            }}
          >
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ 
                background: 'linear-gradient(135deg, rgba(149, 228, 104, 0.2), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(149, 228, 104, 0.2)'
              }}
            >
              <Sparkles className="w-7 h-7 text-[#95e468]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Dragon Admin Panel</h3>
            <p className="text-sm text-[#666666]">Sistema de gerenciamento Dragon v1.0</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
