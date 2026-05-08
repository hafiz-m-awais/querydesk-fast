import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, CheckCircle, Clock, XCircle, TrendingUp, Zap } from 'lucide-react'
import type { StatsResponse } from '@/types'

interface StatsCardsProps { stats: StatsResponse }

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: 'Total',        value: stats.total,       icon: TrendingUp,   color: 'text-gray-600',   bg: 'bg-gray-50' },
    { label: 'Pending',      value: stats.pending,     icon: Clock,        color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Resolved',     value: stats.resolved,    icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Rejected',     value: stats.rejected,    icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Escalated',    value: stats.escalated,   icon: AlertTriangle,color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'SLA Breached', value: stats.sla_breached,icon: AlertTriangle,color: 'text-red-700',    bg: 'bg-red-100' },
    { label: 'Urgent',       value: stats.urgent,      icon: Zap,          color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Avg Resolution', value: `${stats.avg_resolution_hours}h`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
