import type { Metadata } from 'next'
import './styles.css'

export const metadata: Metadata = {
  title: 'SignalDesk scenario staging',
  description: 'Disposable learner environment for the AI Work Simulator.',
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
