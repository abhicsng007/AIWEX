import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section aria-live="polite"><h2>{title}</h2><p>{description}</p>{action}</section>
}
