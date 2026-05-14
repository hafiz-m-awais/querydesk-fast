import { AlertTriangle, CheckCircle, Clock, XCircle, TrendingUp, Zap, BarChart2 } from 'lucide-react'
import type { StatsResponse } from '@/types'

interface StatsCardsProps { stats: StatsResponse }

const cards = (s: StatsResponse) => [
  {
    label: 'Total Queries', value: s.total, icon: BarChart2,
    color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200',
    desc: 'All time',
  },
  {
    label: 'Pending', value: s.pending, icon: Clock,
    color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200',
    desc: 'Awaiting review',
  },
  {
    label: 'Resolved', value: s.resolved, icon: CheckCircle,
    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200',
    desc: 'Successfully closed',
  },
  {
    label: 'Rejected', value: s.rejected, icon: XCircle,
    color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200',
    desc: 'Not accepted',
  },
  {
    label: 'Escalated', value: s.escalated, icon: AlertTriangle,
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200',
    desc: 'Needs attention',
  },
  {
    label: 'SLA Breached', value: s.sla_breached, icon: AlertTriangle,
    color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300',
    desc: 'Overdue response',
  },
  {
    label: 'Urgent', value: s.urgent, icon: Zap,
    color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200',
    desc: 'High priority',
  },
  {
    label: 'Avg Resolution', value: `${s.avg_resolution_hours}h`, icon: TrendingUp,
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200',
    desc: 'Average time',
  },
]

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards(stats).map(({ label, value, icon: Icon, color, bg, border, desc }) => (
        <div key={label} className={`bg-white rounded-xl border ${border} p-4 flex flex-col gap-3`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className={`rounded-lg p-1.5 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

