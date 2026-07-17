'use client'

import { useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronRight, FileCode2, FileDiff, Folder, GitBranch, Play, ShieldCheck, TerminalSquare, X } from 'lucide-react'

type Props = {
  code: string
  setCode: (value: string) => void
  testsPassed: boolean
  committed: boolean
  runTests: () => Promise<void>
  commit: () => void
  openPr: () => void
}

const referenceFiles: Record<string, string> = {
  'alert-list.tsx': `export function AlertList({ alerts }: { alerts: UsageAlert[] }) {
  return (
    <ul className="alert-list">
      {alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)}
    </ul>
  )
}`,
  'types.ts': `export type UsageAlert = {
  id: string
  threshold?: number
  currentUsage: number
  status: 'active' | 'resolved'
}`,
  'empty-state.tsx': `export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <section className="empty-state">
    <h2>{title}</h2>
    <p>{description}</p>
    {action && <Link href={action.href}>{action.label}</Link>}
  </section>
}`,
}

export default function FunctionalWorkspaceView({ code, setCode, testsPassed, committed, runTests, commit, openPr }: Props) {
  const [activeFile, setActiveFile] = useState('alerts-panel.tsx')
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [checkStatus, setCheckStatus] = useState<'idle' | 'error' | 'success'>('idle')
  const content = activeFile === 'alerts-panel.tsx' ? code : referenceFiles[activeFile]
  const lineCount = Math.max(content.split('\n').length, 18)
  const modified = code.includes('canManageBilling')
  const terminalLines = useMemo(() => {
    if (checkStatus === 'error') return ['$ npm run test:usage-alerts', '✗ usage-alerts/empty-state.spec.ts', '  Expected billing CTA to be guarded with canManageBilling.', '  Add the role guard, then rerun checks.']
    if (checkStatus === 'success' || testsPassed) return ['$ npm run test:usage-alerts', '✓ 12 checks passed in 0.38s', '✓ Contract: CTA respects canManageBilling', 'Ready to commit on feat/usage-alerts-empty-state.']
    return ['$ git status', `On branch feat/usage-alerts-empty-state`, modified ? '1 modified file · ready to validate' : '1 modified file · add the billing role guard before validating']
  }, [checkStatus, modified, testsPassed])
  const handleChecks = async () => {
    if (!code.includes('canManageBilling')) { setCheckStatus('error'); await runTests(); return }
    setCheckStatus('success'); await runTests()
  }
  const selectFile = (file: string) => setActiveFile(file)
  return <div className="workspace-page functional-workspace">
    <div className="workspace-header"><div><GitBranch size={16} /><b>feat/usage-alerts-empty-state</b><span>{committed ? '1 commit ahead of main' : 'Uncommitted changes'}</span></div><div><button className={`terminal-button ${terminalOpen ? 'selected' : ''}`} onClick={() => setTerminalOpen((open) => !open)}><TerminalSquare size={16} /> Terminal</button><button className="test-button" onClick={handleChecks}><Play size={15} /> {testsPassed ? '12 checks passed' : 'Run checks'}</button><button className="primary-button" onClick={openPr}>Open pull request</button></div></div>
    <div className="workspace-main">
      <aside className="workspace-explorer"><div className="explorer-heading"><b>EXPLORER</b><span>⋯</span></div><div className="project-root"><ChevronDown size={14} /> signaldesk-web</div><div className="tree-folder"><ChevronDown size={14} /> <Folder size={14} /> src</div><div className="tree-folder nested"><ChevronDown size={14} /> <Folder size={14} /> features</div><div className="tree-folder nested-two"><ChevronDown size={14} /> <Folder size={14} /> usage-alerts</div>{['alerts-panel.tsx', 'alert-list.tsx', 'types.ts'].map((file) => <button className={`tree-file ${activeFile === file ? 'active-file' : ''}`} key={file} onClick={() => selectFile(file)}><FileCode2 size={14} /> {file}{file === 'alerts-panel.tsx' && modified && <i>●</i>}</button>)}<div className="tree-folder"><ChevronDown size={14} /> <Folder size={14} /> components</div><button className={`tree-file nested ${activeFile === 'empty-state.tsx' ? 'active-file' : ''}`} onClick={() => selectFile('empty-state.tsx')}><FileCode2 size={14} /> empty-state.tsx</button><div className="source-summary"><FileDiff size={15} /><span>Source control</span><b>{modified && !committed ? '1' : '0'}</b></div></aside>
      <section className="workspace-editor-card"><div className="editor-tabs"><div className="editor-tab active-tab"><FileCode2 size={15} /> {activeFile}{activeFile === 'alerts-panel.tsx' && modified && <i>●</i>} <X size={13} /></div></div><div className="editor-toolbar"><span>src / {activeFile === 'empty-state.tsx' ? `components / ${activeFile}` : `features / usage-alerts / ${activeFile}`}</span><span>{activeFile === 'alerts-panel.tsx' ? `${code.length} characters` : 'Reference file'}</span></div><div className="editable-code-area"><div className="line-numbers">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>{activeFile === 'alerts-panel.tsx' ? <textarea aria-label="alerts-panel.tsx editor" spellCheck="false" value={code} onChange={(event) => { setCode(event.target.value); setCheckStatus('idle') }} /> : <pre className="reference-code">{content}</pre>}</div><div className="editor-status"><span><span className="dot-green" /> TypeScript React</span><span>{activeFile === 'alerts-panel.tsx' ? 'Editable · local sandbox' : 'Read-only context file'}</span></div></section>
      <aside className="workspace-guide"><div className="guide-title"><Bot size={17} /><b>Noah · Tech lead</b></div><p>Legacy workspaces can’t always manage billing. Guard the plan CTA before you run checks.</p><code>{`action={canManageBilling ? { label: 'Review your plan' } : undefined}`}</code><div className={`check-result ${testsPassed ? 'passing' : checkStatus === 'error' ? 'failing' : ''}`}><ShieldCheck size={17} /><div><b>{testsPassed ? 'Checks passed' : checkStatus === 'error' ? 'Check failed' : 'CI contract check'}</b><span>{testsPassed ? '12 tests completed successfully.' : checkStatus === 'error' ? 'The billing-role guard is required.' : 'Looks for canManageBilling in your change.'}</span></div></div><div className="workspace-requirements"><div><Check size={15} className={testsPassed ? 'ready' : ''} /> Branch checks</div><div><Check size={15} className={committed ? 'ready' : ''} /> Commit on feature branch</div><div><ChevronRight size={15} /> Required review after PR</div></div><button className={committed ? 'commit-button committed' : 'commit-button'} onClick={commit}>{committed ? <><Check size={15} /> Changes committed</> : 'Commit changes'}</button></aside>
    </div>
    {terminalOpen && <section className="workspace-terminal"><div><span><TerminalSquare size={14} /> TERMINAL</span><button onClick={() => setTerminalOpen(false)}><X size={14} /></button></div><pre className={checkStatus === 'error' ? 'terminal-error' : checkStatus === 'success' || testsPassed ? 'terminal-success' : ''}>{terminalLines.map((line) => <code key={line}>{line}</code>)}</pre></section>}
  </div>
}
