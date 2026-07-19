import SimulatorApp from '@/features/simulator/components/simulator-app'

export const dynamic = 'force-dynamic'

/** The server-issued demo cookie authorizes only a disposable in-memory run. */
export default function DemoWorkspacePage() {
  return <SimulatorApp />
}
