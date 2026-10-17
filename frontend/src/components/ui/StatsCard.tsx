import { isValidElement } from 'react'
import type { ReactNode, ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon | ReactNode
  iconColor?: string
  iconBg?: string
  color?: string
  subtitle?: string
  trend?: { value: number; label: string }
}

// Lucide icons are forwardRef objects ({ $$typeof, render }), not functions.
// Rendered elements (<Icon />) also have $$typeof, so exclude those.
function isIconComponent(icon: unknown): icon is ComponentType<{ className?: string }> {
  if (typeof icon === 'function') return true
  return (
    typeof icon === 'object' &&
    icon !== null &&
    !isValidElement(icon) &&
    '$$typeof' in icon
  )
}

const bgColorMap: Record<string, string> = {
  green: 'bg-green-50',
  blue: 'bg-blue-50',
  amber: 'bg-amber-50',
  red: 'bg-red-50',
  gray: 'bg-gray-100',
}

export function StatsCard({
  title,
  value,
  icon,
  iconColor = 'text-primary-700',
  iconBg = 'bg-primary-50',
  color,
  subtitle,
  trend,
}: StatsCardProps) {
  const effectiveBg = color ? (bgColorMap[color] || iconBg) : iconBg
  const Icon = isIconComponent(icon) ? icon : null

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium mt-1 ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`w-11 h-11 ${effectiveBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {Icon ? <Icon className={`w-5 h-5 ${iconColor}`} /> : (icon as ReactNode)}
        </div>
      </div>
    </div>
  )
}