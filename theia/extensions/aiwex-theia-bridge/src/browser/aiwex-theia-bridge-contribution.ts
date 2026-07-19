import { FrontendApplicationContribution } from '@theia/core/lib/browser'
import { ThemeService } from '@theia/core/lib/browser/theming'
import { BinaryBuffer } from '@theia/core/lib/common/buffer'
import { MessageService } from '@theia/core/lib/common/message-service'
import { URI } from '@theia/core/lib/common/uri'
import { inject, injectable } from '@theia/core/shared/inversify'
import { FileService } from '@theia/filesystem/lib/browser/file-service'
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service'

type WorkspaceFile = { path: string; language: 'typescript' | 'tsx' | 'markdown' | 'json'; content: string; updatedAt: string | null; revisionId: string | null }
type Bootstrap = { type: 'aiwex.theia.bootstrap'; token: string; apiOrigin: string; expiresAt: string; files: WorkspaceFile[] }
const root = 'file:///workspace'

function safePath(path: string) {
  return Boolean(path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some((part) => !part || part === '.' || part === '..'))
}

function isBootstrap(value: unknown): value is Bootstrap {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<Bootstrap>
  return message.type === 'aiwex.theia.bootstrap' && typeof message.token === 'string' && typeof message.apiOrigin === 'string' && Array.isArray(message.files)
}

@injectable()
export class AiwexTheiaBridgeContribution implements FrontendApplicationContribution {
  @inject(FileService) protected readonly fileService!: FileService
  @inject(WorkspaceService) protected readonly workspaceService!: WorkspaceService
  @inject(MessageService) protected readonly messages!: MessageService
  @inject(ThemeService) protected readonly themes!: ThemeService

  private token = ''
  private apiOrigin = ''
  private appOrigin = ''
  private hydrating = false
  private readonly revisions = new Map<string, string | null>()
  private readonly paths = new Set<string>()
  private readonly timers = new Map<string, number>()

  onStart(): void {
    void this.useDarkTheme()
    window.addEventListener('message', (event) => { void this.bootstrap(event) })
    this.fileService.onDidFilesChange((event) => {
      if (this.hydrating || !this.token) return
      for (const change of event.changes) {
        const path = this.relative(change.resource)
        if (path && this.paths.has(path)) this.queue(path)
      }
    })
    if (window.parent !== window) window.parent.postMessage({ type: 'aiwex.theia.ready' }, '*')
  }

  /** A deliberate product default; it also replaces an old stored light theme. */
  private async useDarkTheme() {
    await this.themes.initialized
    this.themes.setCurrentTheme('dark', true)
  }

  private async bootstrap(event: MessageEvent<unknown>) {
    if (event.source !== window.parent || this.token || !isBootstrap(event.data) || event.data.apiOrigin !== event.origin) return
    const files = event.data.files.filter((file) => safePath(file.path))
    this.token = event.data.token; this.apiOrigin = event.data.apiOrigin; this.appOrigin = event.origin; this.hydrating = true
    try {
      await this.folder(root)
      for (const file of files) {
        await this.parents(file.path)
        this.paths.add(file.path); this.revisions.set(file.path, file.revisionId)
        await this.fileService.writeFile(this.uri(file.path), BinaryBuffer.fromString(file.content))
      }
      await this.workspaceService.open(new URI(root))
      this.messages.info('SignalDesk is synchronized with the AIWEX event record.')
    } catch (error) {
      this.messages.error(`AIWEX workspace bootstrap failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      window.setTimeout(() => { this.hydrating = false }, 250)
    }
  }

  private uri(path: string) { return new URI(`${root}/${encodeURI(path)}`) }
  private relative(uri: URI) {
    const value = uri.toString(); const prefix = `${root}/`
    return value.startsWith(prefix) ? decodeURI(value.slice(prefix.length)) : ''
  }
  private async folder(value: string) { try { await this.fileService.createFolder(new URI(value)) } catch { /* Existing directory. */ } }
  private async parents(path: string) {
    const parts = path.split('/')
    for (let index = 1; index < parts.length; index += 1) await this.folder(`${root}/${parts.slice(0, index).map(encodeURIComponent).join('/')}`)
  }
  private queue(path: string) {
    const previous = this.timers.get(path); if (previous) window.clearTimeout(previous)
    this.timers.set(path, window.setTimeout(() => { void this.save(path) }, 350))
  }
  private async save(path: string) {
    this.timers.delete(path)
    try {
      const content = (await this.fileService.readFile(this.uri(path))).value.toString()
      const response = await fetch(`${this.apiOrigin}/api/simulation/ide/revisions`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, content, baseRevisionId: this.revisions.get(path) || null }) })
      const result = await response.json().catch(() => ({})) as { file?: WorkspaceFile; error?: string }
      if (!response.ok || !result.file) throw new Error(result.error || 'The revision service rejected the save.')
      this.revisions.set(path, result.file.revisionId)
      window.parent.postMessage({ type: 'aiwex.theia.revision-saved', file: result.file }, this.appOrigin)
    } catch (error) {
      this.messages.error(`AIWEX did not save ${path}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
}
