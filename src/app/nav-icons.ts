import {
  BarChart3,
  BookImage,
  CalendarCheck,
  ClipboardList,
  KanbanSquare,
  MapPin,
  Package,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { NavKey } from '@/lib/nav'

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  today: CalendarCheck,
  tasks: KanbanSquare,
  goals: Target,
  sales: Users,
  checkin: MapPin,
  library: BookImage,
  products: Package,
  reports: ClipboardList,
  dashboard: BarChart3,
  settings: Settings,
}
