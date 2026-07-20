import type { Metadata } from 'next'
import '../styles.css'

export const metadata: Metadata = {
  title: 'AIWEX | AI work simulator',
  description: 'A realistic AI-powered work environment for engineering practice.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
