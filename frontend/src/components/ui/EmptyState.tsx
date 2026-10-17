import type { LucideIcon } from 'lucide-react'
import { InboxIcon } from 'lucide-react'
import { isValidElement } from 'react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon | ReactNode
  title: string
  description: string
  action?: ReactNode
}

// A lucide icon is a forwardRef object ({ $$typeof, render }) or a function.
// A rendered element (<Icon />), string, number, etc. is a normal ReactNode.
function isComponentType(icon: unknown): icon is LucideIcon {
  if (typeof icon === 'function') return true
  return (
    typeof icon === 'object' &&
    icon !== null &&
    !isValidElement(icon) &&
    '$$typeof' in icon
  )
}

export function EmptyState({ icon = InboxIcon, title, description, action }: EmptyStateProps) {
  const Icon = isComponentType(icon) ? icon : null

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {Icon ? <Icon className="w-8 h-8 text-gray-400" /> : (icon as ReactNode)}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  )
}