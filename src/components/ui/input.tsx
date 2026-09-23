import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 sm:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 sm:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 sm:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium', className)} {...props} />
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="text-sm text-destructive">{children}</p>
}
