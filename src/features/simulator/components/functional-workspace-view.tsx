'use client'

import { useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronRight, FileCode2, FileDiff, FileText, Folder, GitBranch, Play, Save, ShieldCheck, TerminalSquare, X } from 'lucide-react'
import type { WorkspaceFile } from '@/features/simulator/domain/workspace'
import { signalDeskScenarioProject } from '@/features/simulator/domain/scenario-project'

type Props = {
  files: WorkspaceFile[]
  updateFile: (path: string, content: string) => void
  saveFile: (path: string) => Promise<boolean>
  testsPassed: boolean
  committed: boolean
  testOutput?: string
  testDurationMs?: number
  runTests: () => Promise<boolean>
  commit: () => void
  openPr: () => void
}

export default function FunctionalWorkspaceView({ files, updateFile, saveFile, testsPassed, committed, testOutput, testDurationMs, runTests, commit, openPr }: Props) {
  const [activePath, setActivePath] = useState('app/components/alerts-panel.tsx')
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [checkStatus, setCheckStatus] = useState<'idle' | 'error' | 'success'>('idle')
  const [dirtyPaths, setDirtyPaths] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const activeFile = files.find((file) => file.path === activePath) || files[0]
  const modified = dirtyPaths.length > 0
  const lineCount = Math.max(activeFile?.content.split('\n').length || 1, 18)
  const terminalLines = useMemo(() => {
    if (testOutput) return ['$ node --test tests/alerts-panel.test.cjs', ...testOutput.split('\n').filter(Boolean).slice(-12)]
    if (checkStatus === 'error') return ['$ node --test tests/alerts-panel.test.cjs', 'Scenario validation failed. Update the source and try again.']
    if (checkStatus === 'success' || testsPassed) return ['$ node --test tests/alerts-panel.test.cjs', 'Scenario source passed the permission-guard checks.', 'Ready to commit on feat/usage-alerts-empty-state.']
    return ['$ git status', 'On branch feat/usage-alerts-empty-state', modified ? `${dirtyPaths.length} unsaved workspace file${dirtyPaths.length === 1 ? '' : 's'}` : 'Workspace is synchronized with the simulation record']
  }, [checkStatus, dirtyPaths.length, modified, testOutput, testsPassed])
  const handleChange = (content: string) => {
    if (!activeFile) return
    updateFile(activeFile.path, content)
    setDirtyPaths((paths) => paths.includes(activeFile.path) ? paths : [...paths, activeFile.path])
    setCheckStatus('idle')
  }
  const handleSave = async () => {
    if (!activeFile) return
    setSaving(true)
    const saved = await saveFile(activeFile.path)
    if (saved) setDirtyPaths((paths) => paths.filter((path) => path !== activeFile.path))
    setSaving(false)
  }
  const handleChecks = async () => setCheckStatus(await runTests() ? 'success' : 'error')
  const fileLabel = (path: string) => path.split('/').at(-1) || path
  return <div className="workspace-page functional-workspace">
    <div className="workspace-header"><div><GitBranch size={16} /><b>{signalDeskScenarioProject.learnerBranch}</b><span>{committed ? '1 commit ahead of main' : modified ? `${dirtyPaths.length} unsaved file${dirtyPaths.length === 1 ? '' : 's'}` : 'Workspace synchronized'}</span></div><div><button className={`terminal-button ${terminalOpen ? 'selected' : ''}`} onClick={() => setTerminalOpen((open) => !open)}><TerminalSquare size={16} /> Terminal</button><button className="test-button" onClick={handleChecks}><Play size={15} /> {testsPassed ? 'Scenario checks passed' : 'Run scenario checks'}</button><button className="primary-button" onClick={openPr}>Open pull request</button></div></div>
    <div className="scenario-repository-banner"><FileCode2 size={15} /><span><b>Private scenario repository:</b> {signalDeskScenarioProject.repositoryPath}</span><code>{signalDeskScenarioProject.stagingContract}</code><small>Server-saved revisions · isolated validation runner</small></div>
    <div className="workspace-main">
      <aside className="workspace-explorer"><div className="explorer-heading"><b>EXPLORER</b><span>{files.length} files</span></div><div className="project-root"><ChevronDown size={14} /> signaldesk-web</div><div className="tree-folder"><ChevronDown size={14} /> <Folder size={14} /> app</div><div className="tree-folder nested"><ChevronDown size={14} /> <Folder size={14} /> components</div>{files.map((file) => <button className={`tree-file ${activeFile?.path === file.path ? 'active-file' : ''}`} key={file.path} onClick={() => setActivePath(file.path)}><FileCode2 size={14} /> {file.path === 'README.md' ? <FileText size={14} /> : null}{fileLabel(file.path)}{dirtyPaths.includes(file.path) && <i>●</i>}</button>)}<div className="source-summary"><FileDiff size={15} /><span>Source control</span><b>{modified && !committed ? String(dirtyPaths.length) : '0'}</b></div></aside>
      <section className="workspace-editor-card"><div className="editor-tabs"><div className="editor-tab active-tab"><FileCode2 size={15} /> {activeFile ? fileLabel(activeFile.path) : 'No file'}{activeFile && dirtyPaths.includes(activeFile.path) && <i>●</i>} <X size={13} /></div></div><div className="editor-toolbar"><span>{activeFile?.path}</span><span>{activeFile?.revisionId ? `Revision ${activeFile.revisionId.slice(0, 8)}` : 'Scenario baseline'}</span></div><div className="editable-code-area"><div className="line-numbers">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>{activeFile && <textarea aria-label={`${activeFile.path} editor`} spellCheck="false" value={activeFile.content} onChange={(event) => handleChange(event.target.value)} />}</div><div className="editor-status"><span><span className="dot-green" /> {activeFile?.language.toUpperCase() || 'TEXT'}</span><span>{dirtyPaths.includes(activeFile?.path || '') ? 'Unsaved local revision' : 'Server revision synchronized'}</span><button className="workspace-save-button" disabled={!activeFile || saving || !dirtyPaths.includes(activeFile.path)} onClick={() => void handleSave()}><Save size={14} /> {saving ? 'Saving…' : 'Save revision'}</button></div></section>
      <aside className="workspace-guide"><div className="guide-title"><Bot size={17} /><b>Noah · Tech lead</b></div><p>Use the workspace as a real review surface: save a revision, run the isolated checks, then make the decision visible in the PR.</p><code>{`action={canManageBilling ? <a href="/settings/billing">Review your plan</a> : undefined}`}</code><div className={`check-result ${testsPassed ? 'passing' : checkStatus === 'error' ? 'failing' : ''}`}><ShieldCheck size={17} /><div><b>{testsPassed ? 'Verified scenario checks passed' : checkStatus === 'error' ? 'Check failed' : 'Validation sandbox'}</b><span>{testsPassed ? `Server executed the scenario test${testDurationMs ? ` in ${testDurationMs}ms` : ''}.` : checkStatus === 'error' ? 'Read the executed test output in the terminal.' : 'Checks run against the currently saved alerts-panel revision.'}</span></div></div><div className="workspace-requirements"><div><Check size={15} className={testsPassed ? 'ready' : ''} /> Verified branch checks</div><div><Check size={15} className={committed ? 'ready' : ''} /> Commit on feature branch</div><div><ChevronRight size={15} /> Required review after PR</div></div><button className={committed ? 'commit-button committed' : 'commit-button'} onClick={commit}>{committed ? <><Check size={15} /> Changes committed</> : 'Commit changes'}</button></aside>
    </div>
    {terminalOpen && <section className="workspace-terminal"><div><span><TerminalSquare size={14} /> TERMINAL</span><button onClick={() => setTerminalOpen(false)}><X size={14} /></button></div><pre className={checkStatus === 'error' ? 'terminal-error' : checkStatus === 'success' || testsPassed ? 'terminal-success' : ''}>{terminalLines.map((line, index) => <code key={`${index}-${line}`}>{line}</code>)}</pre></section>}
  </div>
}
