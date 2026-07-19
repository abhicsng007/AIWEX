'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronRight, FileCode2, FileDiff, FileText, Folder, FolderOpen, GitBranch, Maximize2, Minimize2, Play, Save, ShieldCheck, TerminalSquare, X } from 'lucide-react'
import type { WorkspaceFile } from '@/features/simulator/domain/workspace'
import { signalDeskScenarioProject } from '@/features/simulator/domain/scenario-project'

type WorkspaceTreeNode = {
  name: string
  path: string
  file?: WorkspaceFile
  children: WorkspaceTreeNode[]
}

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
  openTheia: () => void
}

function workspaceTree(files: WorkspaceFile[]) {
  const root: WorkspaceTreeNode = { name: 'signaldesk-web', path: '', children: [] }
  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean)
    let parent = root
    for (const [index, segment] of segments.entries()) {
      const path = segments.slice(0, index + 1).join('/')
      if (index === segments.length - 1) {
        parent.children.push({ name: segment, path, file, children: [] })
        continue
      }
      let folder = parent.children.find((node) => !node.file && node.name === segment)
      if (!folder) {
        folder = { name: segment, path, children: [] }
        parent.children.push(folder)
      }
      parent = folder
    }
  }
  const sortChildren = (node: WorkspaceTreeNode) => {
    node.children.sort((left, right) => Number(Boolean(left.file)) - Number(Boolean(right.file)) || left.name.localeCompare(right.name))
    node.children.forEach(sortChildren)
  }
  sortChildren(root)
  return root
}

export default function FunctionalWorkspaceView({ files, updateFile, saveFile, testsPassed, committed, testOutput, testDurationMs, runTests, commit, openPr, openTheia }: Props) {
  const [activePath, setActivePath] = useState('app/components/alerts-panel.tsx')
  const [openPaths, setOpenPaths] = useState(['app/components/alerts-panel.tsx'])
  const [tabWidths, setTabWidths] = useState<Record<string, number>>({})
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [checkStatus, setCheckStatus] = useState<'idle' | 'error' | 'success'>('idle')
  const [dirtyPaths, setDirtyPaths] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [collapsedPaths, setCollapsedPaths] = useState<string[]>([])
  const activeFile = activePath ? files.find((file) => file.path === activePath) : undefined
  const openFiles = openPaths.map((path) => files.find((file) => file.path === path)).filter((file): file is WorkspaceFile => Boolean(file))
  const explorerTree = useMemo(() => workspaceTree(files), [files])
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
    try {
      const saved = await saveFile(activeFile.path)
      if (saved) setDirtyPaths((paths) => paths.filter((path) => path !== activeFile.path))
    } finally {
      setSaving(false)
    }
  }
  const handleChecks = async () => {
    setChecking(true)
    try {
      setCheckStatus(await runTests() ? 'success' : 'error')
    } catch {
      setCheckStatus('error')
    } finally {
      setChecking(false)
    }
  }
  const toggleFolder = (path: string) => setCollapsedPaths((paths) => paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path])
  const fileLabel = (path: string) => path.split('/').at(-1) || path
  const openFile = (path: string) => {
    setOpenPaths((paths) => paths.includes(path) ? paths : [...paths, path])
    setActivePath(path)
  }
  const closeFile = (path: string) => {
    const closingIndex = openPaths.indexOf(path)
    const remaining = openPaths.filter((item) => item !== path)
    setOpenPaths(remaining)
    if (activePath === path) setActivePath(remaining[closingIndex] || remaining[closingIndex - 1] || '')
  }
  const startTabResize = (event: React.PointerEvent<HTMLSpanElement>, path: string) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = tabWidths[path] || 190
    const resize = (moveEvent: PointerEvent) => setTabWidths((widths) => ({ ...widths, [path]: Math.min(420, Math.max(128, startWidth + moveEvent.clientX - startX)) }))
    const finish = () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', finish)
  }
  useEffect(() => {
    if (!focusMode) return
    const previousOverflow = document.body.style.overflow
    const exitOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocusMode(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', exitOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', exitOnEscape)
    }
  }, [focusMode])
  const renderTree = (node: WorkspaceTreeNode, depth = 0): React.ReactNode => {
    if (node.file) {
      const FileIcon = node.file.path === 'README.md' ? FileText : FileCode2
      const selected = activeFile?.path === node.file.path
      return <li key={node.path}><button className={`tree-file ${selected ? 'active-file' : ''}`} type="button" style={{ paddingLeft: `${8 + depth * 14}px` }} aria-current={selected ? 'page' : undefined} title={node.file.path} onClick={() => openFile(node.file!.path)}><FileIcon size={14} /> {node.name}{dirtyPaths.includes(node.file.path) && <i>●</i>}</button></li>
    }
    const expanded = !collapsedPaths.includes(node.path)
    const childListId = `workspace-tree-${node.path || 'root'}`.replace(/[^a-z0-9_-]/gi, '-')
    return <li key={node.path || 'root'}><button className={`tree-folder ${depth === 0 ? 'project-root' : ''}`} type="button" style={{ paddingLeft: `${8 + depth * 14}px` }} aria-expanded={expanded} aria-controls={childListId} onClick={() => toggleFolder(node.path)}>{expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}{expanded ? <FolderOpen size={14} aria-hidden="true" /> : <Folder size={14} aria-hidden="true" />}{node.name}</button><ul className="workspace-tree-children" id={childListId} hidden={!expanded}>{node.children.map((child) => renderTree(child, depth + 1))}</ul></li>
  }

  return <div className={`workspace-page functional-workspace ${focusMode ? 'workspace-focus-mode' : ''}`}>
    <div className="workspace-header"><div><GitBranch size={16} /><b>{signalDeskScenarioProject.learnerBranch}</b><span>{committed ? '1 commit ahead of main' : modified ? `${dirtyPaths.length} unsaved file${dirtyPaths.length === 1 ? '' : 's'}` : 'Workspace synchronized'}</span></div><div><button className="theia-launch-button" type="button" onClick={openTheia}>Try Theia beta</button><button className="workspace-focus-button" type="button" aria-pressed={focusMode} onClick={() => setFocusMode((enabled) => !enabled)} title={focusMode ? 'Exit focus mode (Esc)' : 'Hide app navigation and focus on the IDE'}>{focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{focusMode ? 'Exit focus' : 'Focus mode'}</button><button className={`terminal-button ${terminalOpen ? 'selected' : ''}`} type="button" aria-pressed={terminalOpen} onClick={() => setTerminalOpen((open) => !open)}><TerminalSquare size={16} /> Terminal</button><button className="test-button" type="button" disabled={checking} onClick={() => void handleChecks()}><Play size={15} /> {checking ? 'Running scenario checks…' : testsPassed ? 'Scenario checks passed' : 'Run scenario checks'}</button><button className="primary-button" type="button" onClick={openPr}>Open pull request</button></div></div>
    <div className="scenario-repository-banner"><FileCode2 size={15} /><span><b>Private scenario repository:</b> {signalDeskScenarioProject.repositoryPath}</span><code>{signalDeskScenarioProject.stagingContract}</code><small>Server-saved revisions · isolated validation runner</small></div>
    <div className="workspace-main">
      <aside className="workspace-explorer"><div className="explorer-heading"><b>EXPLORER</b><span>{files.length} files</span></div><nav aria-label="Scenario repository files"><ul className="workspace-tree">{renderTree(explorerTree)}</ul></nav><div className="source-summary"><FileDiff size={15} /><span>Source control</span><b>{modified && !committed ? String(dirtyPaths.length) : '0'}</b></div></aside>
      <section className="workspace-editor-card">
        <div className="editor-tabs" role="tablist" aria-label="Open workspace files">
          {openFiles.map((file) => {
            const TabIcon = file.language === 'markdown' ? FileText : FileCode2
            const selected = activeFile?.path === file.path
            return <div className={`editor-tab ${selected ? 'active-tab' : ''}`} style={{ width: `${tabWidths[file.path] || 190}px` }} key={file.path}>
              <button className="editor-tab-select" type="button" role="tab" aria-selected={selected} onClick={() => setActivePath(file.path)} title={file.path}><TabIcon size={14} /><span>{fileLabel(file.path)}</span>{dirtyPaths.includes(file.path) && <i>●</i>}</button>
              <button className="editor-tab-close" type="button" aria-label={`Close ${fileLabel(file.path)}`} onClick={() => closeFile(file.path)}><X size={13} /></button>
              <span className="editor-tab-resize" role="separator" aria-orientation="vertical" aria-label={`Resize ${fileLabel(file.path)} tab`} title="Drag to resize this tab; double-click to reset" onPointerDown={(event) => startTabResize(event, file.path)} onDoubleClick={() => setTabWidths((widths) => { const next = { ...widths }; delete next[file.path]; return next })} />
            </div>
          })}
          {openFiles.length === 0 && <span className="editor-tabs-empty">Open a file from Explorer</span>}
        </div>
        <div className="editor-toolbar"><span>{activeFile?.path || 'No file selected'}</span><span>{activeFile?.revisionId ? `Revision ${activeFile.revisionId.slice(0, 8)}` : activeFile ? 'Scenario baseline' : 'Explorer is ready'}</span></div>
        <div className="editable-code-area">{activeFile ? <><div className="line-numbers">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div><textarea aria-label={`${activeFile.path} editor`} spellCheck="false" value={activeFile.content} onChange={(event) => handleChange(event.target.value)} /></> : <div className="workspace-editor-empty"><FileCode2 size={22} /><b>No file open</b><span>Choose a file in Explorer to open it in a tab.</span></div>}</div>
        <div className="editor-status"><span><span className="dot-green" /> {activeFile?.language.toUpperCase() || 'TEXT'}</span><span>{activeFile ? dirtyPaths.includes(activeFile.path) ? 'Unsaved local revision' : 'Server revision synchronized' : 'No active editor'}</span><button className="workspace-save-button" type="button" disabled={!activeFile || saving || !dirtyPaths.includes(activeFile.path)} onClick={() => void handleSave()}><Save size={14} /> {saving ? 'Saving…' : 'Save revision'}</button></div>
      </section>
      <aside className="workspace-guide"><div className="guide-title"><Bot size={17} /><b>Noah · Tech lead</b></div><p>Use the workspace as a real review surface: save a revision, run the isolated checks, then make the decision visible in the PR.</p><code>{`action={canManageBilling ? <a href="/settings/billing">Review your plan</a> : undefined}`}</code><div className={`check-result ${testsPassed ? 'passing' : checkStatus === 'error' ? 'failing' : ''}`}><ShieldCheck size={17} /><div><b>{testsPassed ? 'Verified scenario checks passed' : checkStatus === 'error' ? 'Check failed' : 'Validation sandbox'}</b><span>{testsPassed ? `Server executed the scenario test${testDurationMs ? ` in ${testDurationMs}ms` : ''}.` : checkStatus === 'error' ? 'Read the executed test output in the terminal.' : 'Checks run against the currently saved alerts-panel revision.'}</span></div></div><div className="workspace-requirements"><div><Check size={15} className={testsPassed ? 'ready' : ''} /> Verified branch checks</div><div><Check size={15} className={committed ? 'ready' : ''} /> Commit on feature branch</div><div><ChevronRight size={15} /> Required review after PR</div></div><button className={committed ? 'commit-button committed' : 'commit-button'} type="button" onClick={commit}>{committed ? <><Check size={15} /> Changes committed</> : 'Commit changes'}</button></aside>
    </div>
    {terminalOpen && <section className="workspace-terminal"><div><span><TerminalSquare size={14} /> TERMINAL</span><button type="button" aria-label="Close terminal" onClick={() => setTerminalOpen(false)}><X size={14} /></button></div><pre className={checkStatus === 'error' ? 'terminal-error' : checkStatus === 'success' || testsPassed ? 'terminal-success' : ''}>{terminalLines.map((line, index) => <code key={`${index}-${line}`}>{line}</code>)}</pre></section>}
  </div>
}
