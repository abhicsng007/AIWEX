'use client'

import { Bot, Check, FileCode2, GitBranch, Play, ShieldCheck, TerminalSquare } from 'lucide-react'

type Props = {
  code: string
  setCode: (value: string) => void
  testsPassed: boolean
  committed: boolean
  runTests: () => void
  commit: () => void
  openPr: () => void
}

export default function FunctionalWorkspaceView({ code, setCode, testsPassed, committed, runTests, commit, openPr }: Props) {
  const lineCount = Math.max(code.split('\n').length, 18)
  return <div className="workspace-page">
    <div className="workspace-header">
      <div><GitBranch size={16} /><b>feat/usage-alerts-empty-state</b><span>ahead {committed ? 1 : 0}</span></div>
      <div><button className="terminal-button"><TerminalSquare size={16} /> Terminal</button><button className="test-button" onClick={runTests}><Play size={15} /> {testsPassed ? '12 checks passed' : 'Run checks'}</button><button className="primary-button" onClick={openPr}>Open pull request</button></div>
    </div>
    <div className="functional-editor-shell">
      <section className="workspace-editor-card">
        <div className="editor-tabs"><div className="editor-tab active-tab"><FileCode2 size={15} /> alerts-panel.tsx</div></div>
        <div className="editor-toolbar"><span>src / features / usage-alerts / alerts-panel.tsx</span><span>{code.length} characters</span></div>
        <div className="editable-code-area"><div className="line-numbers">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div><textarea aria-label="alerts-panel.tsx editor" spellCheck="false" value={code} onChange={(event) => setCode(event.target.value)} /></div>
        <div className="editor-status"><span><span className="dot-green" /> TypeScript React</span><span>Editable workspace · local sandbox</span></div>
      </section>
      <aside className="workspace-guide">
        <div className="guide-title"><Bot size={17} /><b>Noah · Tech lead</b></div>
        <p>Legacy workspaces can’t always manage billing. Guard the plan CTA before you run checks.</p>
        <code>{`action={canManageBilling ? { label: 'Review your plan' } : undefined}`}</code>
        <div className={`check-result ${testsPassed ? 'passing' : ''}`}><ShieldCheck size={17} /><div><b>{testsPassed ? 'Checks passed' : 'CI contract check'}</b><span>{testsPassed ? '12 tests completed successfully.' : 'Looks for canManageBilling in your change.'}</span></div></div>
        <div className="workspace-requirements"><div><Check size={15} className={testsPassed ? 'ready' : ''} /> Branch checks</div><div><Check size={15} className={committed ? 'ready' : ''} /> Commit on feature branch</div><div><span /> Required review after PR</div></div>
        <button className={committed ? 'commit-button committed' : 'commit-button'} onClick={commit}>{committed ? <><Check size={15} /> Changes committed</> : 'Commit changes'}</button>
      </aside>
    </div>
  </div>
}
