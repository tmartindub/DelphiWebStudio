import { useState } from 'react'
import {
  Globe,
  FileJson,
  ExternalLink,
  Download,
  Eye,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { useProjectsStore } from '@/store/projectsStore'
import { exportToHTML, downloadHTML, previewHTML, exportSiteZip } from '@/lib/export-html'
import { portableProjectsEnabled } from '@/project/project-file'
import { ProjectMediaLibrary } from '@/media/media-library'
import { publishSite } from '@/lib/publish-site'
import JSZip from 'jszip'
import { createRestorePlan, createWebsiteManifest, validateWebsiteManifest, compareWebsiteManifests, type WebsiteManifest } from '@/lib/website-manifest'
import { checkSite, type SiteIssue } from '@/project/site-checks'

const readyOptions = [
  { icon: Download, label: 'Static HTML', description: 'Download a standalone HTML file', action: 'html' },
  { icon: FileJson, label: 'JSON Config', description: 'Download the raw JSON config file', action: 'json' },
  { icon: Eye, label: 'Preview in Browser', description: 'Open a standalone preview in a new tab', action: 'preview' },
] as const


export function Deploy() {
  const config = useConfigStore((s) => s.config)
  const activeProjectId = useEditorStore((s) => s.activeProjectId)
  const projects = useProjectsStore((s) => s.projects)
  const setDeployInfo = useProjectsStore((s) => s.setDeployInfo)

  const project = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
  const deployUrl = project?.deployUrl
  const lastDeployedAt = project?.lastDeployedAt
  const hasDeployKey = !!project?.settings?.deployAccessKey?.trim()

  const [exporting, setExporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [review, setReview] = useState<{ signature: string; files: string[]; warnings: SiteIssue[]; zip: Blob; filename: string } | null>(null)
  const [manifest, setManifest] = useState<{ signature: string; data: WebsiteManifest } | null>(null)
  const [comparison, setComparison] = useState<{ signature: string; result: ReturnType<typeof compareWebsiteManifests> } | null>(null)
  const [restoreBackup, setRestoreBackup] = useState<File | null>(null)
  const [restoreScan, setRestoreScan] = useState<File | null>(null)
  const [restorePlan, setRestorePlan] = useState<ReturnType<typeof compareWebsiteManifests> | null>(null)
  const [restoreWorking, setRestoreWorking] = useState(false)
  const signature = JSON.stringify({ projectId: activeProjectId, config, settings: project?.settings, mediaRevision: project?.mediaRevision })

  async function reviewWebsiteFiles() {
    if (!activeProjectId) { toast.error('Open a project first'); return }
    setExporting(true)
    try {
      const media = await new ProjectMediaLibrary().list(activeProjectId)
      const zip = await exportSiteZip(config, { settings: project?.settings }, media)
      const archive = await JSZip.loadAsync(await zip.arrayBuffer())
      const currentProjectId = useEditorStore.getState().activeProjectId
      const currentProject = useProjectsStore.getState().projects.find(item => item.id === currentProjectId)
      const current = JSON.stringify({ projectId: currentProjectId, config: useConfigStore.getState().config, settings: currentProject?.settings, mediaRevision: currentProject?.mediaRevision })
      if (current !== signature) throw new Error('The project changed during the review. Review the files again.')
      const files = Object.values(archive.files).filter(item => !item.dir).map(item => item.name).sort()
      const warnings = checkSite(config, project?.settings ?? {}).filter(issue => !config.pages?.some(page => page.id === issue.pageId && page.webstudioArticle?.status === 'draft'))
      const filename = `${(project?.name || config.name || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.zip`
      setReview({ signature, files, warnings, zip, filename })
    } catch (error) {
      setReview(null)
      toast.error(error instanceof Error ? error.message : 'Website files could not be reviewed')
    } finally { setExporting(false) }
  }

  async function prepareManifest() {
    if (!review || review.signature !== signature) return
    setExporting(true)
    try {
      const data = await createWebsiteManifest(review.zip)
      setManifest({ signature: review.signature, data })
      setComparison(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Website manifest could not be prepared')
    } finally { setExporting(false) }
  }

  async function comparePreviousManifest(file: File) {
    if (!manifest || manifest.signature !== signature) return
    if (file.size > 2 * 1024 * 1024) { toast.error('The website manifest is too large.'); return }
    try {
      const previous = validateWebsiteManifest(JSON.parse(await file.text()))
      setComparison({ signature: manifest.signature, result: compareWebsiteManifests(previous, manifest.data) })
    } catch (error) {
      setComparison(null)
      toast.error(error instanceof Error ? error.message : 'The previous website manifest is invalid')
    }
  }

  async function reviewRestorePlan() {
    if (!restoreBackup || !restoreScan) return
    if (restoreScan.size > 2 * 1024 * 1024) { toast.error('The destination scan is too large.'); return }
    setRestoreWorking(true)
    setRestorePlan(null)
    try {
      setRestorePlan(await createRestorePlan(restoreBackup, JSON.parse(await restoreScan.text())))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The restore plan could not be prepared')
    } finally { setRestoreWorking(false) }
  }

  async function handleExport(action: (typeof readyOptions)[number]['action']) {
    if (action === 'json') {
      const jsonStr = JSON.stringify(config, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'site-config.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('JSON config downloaded')
      return
    }

    setExporting(true)
    try {
      if (action === 'html' && portableProjectsEnabled) {
        const filename = (project?.name || config.name || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
        const media = activeProjectId ? await new ProjectMediaLibrary().list(activeProjectId) : []
        downloadHTML(await exportSiteZip(config, { settings: project?.settings }, media), `${filename}.zip`)
        toast('Website ZIP exported')
        return
      }
      const html = await exportToHTML(config, { settings: project?.settings })

      if (action === 'html') {
        const filename = `${(project?.name || config.name || 'site').toLowerCase().replace(/\s+/g, '-')}.html`
        downloadHTML(html, filename)
        toast('HTML exported')
      } else {
        previewHTML(html)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : action === 'preview' ? 'Preview failed' : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handlePublish() {
    if (portableProjectsEnabled) {
      toast.error('Publishing is not available until destination review and verification are implemented.')
      return
    }
    if (!activeProjectId) {
      toast.error('Save your project first')
      return
    }

    setPublishing(true)
    try {
      const { liveUrl, deploymentId } = await publishSite({
        config,
        projectName: project?.name || config.name,
        settings: project?.settings,
      })
      setDeployInfo(activeProjectId, liveUrl, deploymentId)
      toast.success('Published')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deploy failed')
    } finally {
      setPublishing(false)
    }
  }

  function handleCopy() {
    if (!deployUrl) return
    navigator.clipboard
      .writeText(deployUrl)
      .then(() => {
        setCopied(true)
        toast('URL copied')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Could not copy URL'))
  }

  const timeAgo = lastDeployedAt ? formatTimeAgo(lastDeployedAt) : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-12 pt-8">
        <h1 className="text-[22px] font-display font-semibold tracking-tight animate-fade-in-up stagger-1">Export</h1>
        <p className="text-text-2 text-[13px] mt-1 animate-fade-in-up stagger-2">Download or publish your site</p>
      </div>

      <div className="px-4 md:px-12 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {readyOptions.map((opt, i) => (
            <div
              key={opt.label}
              onClick={() => !exporting && handleExport(opt.action)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`flex items-start gap-3 p-4 rounded-xl border bg-bg-1 border-border-default card-lift hover:border-border-hover cursor-pointer hover:card-lift-hover animate-fade-in-up ${exporting ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="w-9 h-9 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green shrink-0">
                <opt.icon size={16} />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold">{opt.label}</span>
                <p className="text-[11.5px] text-text-2 mt-0.5">{opt.description}</p>
              </div>
              <ExternalLink size={14} className="text-text-3 mt-1 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {portableProjectsEnabled && <div className="px-4 md:px-12 pt-6">
        <div className="rounded-xl border border-border-default bg-bg-1 p-4">
          <h2 className="text-sm font-semibold">Review website files</h2>
          <p className="mt-1 text-xs text-text-2">Build a local website ZIP and inspect its file list. This does not compare a destination or publish anything.</p>
          <button type="button" onClick={reviewWebsiteFiles} disabled={exporting || !activeProjectId} className="mt-3 rounded border border-border-default px-3 py-2 text-xs disabled:opacity-50">{exporting ? 'Preparing…' : 'Review files'}</button>
          {review && (review.signature === signature ? <div className="mt-3">
            <div className="mb-3 rounded border border-border-default p-2 text-xs" aria-label="Website validation results">
              <p className="font-semibold">Local checks: {review.warnings.length} {review.warnings.length === 1 ? 'finding' : 'findings'}</p>
              {review.warnings.length > 0 && <ul className="mt-1 max-h-36 overflow-auto">{review.warnings.map((warning, index) => <li key={`${warning.pageId}-${warning.blockId}-${index}`}><strong>{warning.pageName}:</strong> {warning.message}</li>)}</ul>}
              <p className="mt-1 text-text-2">These limited checks do not cover all links or accessibility issues.</p>
            </div>
            <p className="text-xs text-text-1">{review.files.length} files in the prepared website ZIP.</p>
            <ul aria-label="Website files" className="mt-2 max-h-48 overflow-auto rounded border border-border-subtle p-2 font-mono text-xs">{review.files.map(file => <li key={file} className="break-all">{file}</li>)}</ul>
            <button type="button" onClick={() => downloadHTML(review.zip, review.filename)} className="mt-3 rounded border border-border-default px-3 py-2 text-xs">Download reviewed ZIP</button>
            <div className="mt-4 border-t border-border-subtle pt-3">
              <p className="text-xs text-text-2">Compare this website with a saved file manifest or a destination scan from the SFTP connection menu. The selected file reflects its capture time; scan again if the destination changes.</p>
              <button type="button" onClick={prepareManifest} disabled={exporting} className="mt-2 rounded border border-border-default px-3 py-2 text-xs disabled:opacity-50">{exporting ? 'Preparing…' : 'Prepare file manifest'}</button>
              {manifest?.signature === signature && <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => downloadHTML(new Blob([JSON.stringify(manifest.data, null, 2) + '\n'], { type: 'application/json' }), review.filename.replace(/\.zip$/i, '-manifest.json'))} className="rounded border border-border-default px-3 py-2 text-xs">Download file manifest</button>
                <label className="text-xs">Compare manifest or destination scan <input aria-label="Compare website manifest or destination scan" type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void comparePreviousManifest(file) }} /></label>
              </div>}
              {comparison?.signature === signature && <div className="mt-3 text-xs">{(['added', 'changed', 'removed'] as const).map(kind => <div key={kind} className="mt-2"><p className="font-semibold capitalize">{kind}: {comparison.result[kind].length}</p><ul aria-label={`${kind} files`} className="max-h-32 overflow-auto font-mono">{comparison.result[kind].map(path => <li key={path} className="break-all">{path}</li>)}</ul></div>)}</div>}
            </div>
          </div> : <p className="mt-3 text-xs text-text-2">The project changed. Review the files again before downloading this version.</p>)}
        </div>
      </div>}

      {portableProjectsEnabled && <div className="px-4 md:px-12 pt-6 text-xs text-text-2">Publishing is not available yet. Website ZIP export and local file review are available.</div>}
      {portableProjectsEnabled && <div className="px-4 md:px-12 pt-6">
        <div className="rounded-xl border border-border-default bg-bg-1 p-4">
          <h2 className="text-sm font-semibold">Review a restore plan</h2>
          <p className="mt-1 text-xs text-text-2">Choose a destination backup ZIP and a recent SFTP destination scan. This comparison lists files only; it does not restore or delete anything. Scan again if the destination has changed.</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <label>Backup ZIP <input type="file" accept=".zip,application/zip" disabled={restoreWorking} onChange={event => { setRestoreBackup(event.target.files?.[0] ?? null); setRestorePlan(null) }} /></label>
            <label>Destination scan <input type="file" accept=".json,application/json" disabled={restoreWorking} onChange={event => { setRestoreScan(event.target.files?.[0] ?? null); setRestorePlan(null) }} /></label>
          </div>
          <button type="button" onClick={reviewRestorePlan} disabled={!restoreBackup || !restoreScan || restoreWorking} className="mt-3 rounded border border-border-default px-3 py-2 text-xs disabled:opacity-50">{restoreWorking ? 'Checking backup…' : 'Review restore plan'}</button>
          {restorePlan && <div className="mt-3 text-xs">{([['added', 'Missing from destination'], ['changed', 'Different contents'], ['removed', 'Only on destination']] as const).map(([kind, label]) => <div key={kind} className="mt-2"><p className="font-semibold">{label}: {restorePlan[kind].length}</p><ul aria-label={label} className="max-h-32 overflow-auto font-mono">{restorePlan[kind].map(path => <li key={path} className="break-all">{path}</li>)}</ul></div>)}</div>}
        </div>
      </div>}
      {hasDeployKey && !portableProjectsEnabled && (
        <div className="px-4 md:px-12 pt-8 animate-fade-in-up stagger-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-3 mb-3">Publish</h2>
          <div className="p-5 rounded-xl border bg-bg-1 border-border-default">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green/10 border border-green/20 flex items-center justify-center text-green shrink-0">
                <Globe size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">Publish to Web</h3>
                <p className="text-[11.5px] text-text-2 mt-0.5">
                  Deploy your site to a live URL in seconds
                </p>

                {deployUrl && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-3 border border-border-subtle">
                      <div className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                      <a
                        href={deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-green hover:underline truncate"
                      >
                        {deployUrl.replace('https://', '')}
                      </a>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="w-8 h-8 rounded-lg border border-border-default hover:border-border-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-all shrink-0"
                      title="Copy URL"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <a
                      href={deployUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg border border-border-default hover:border-border-hover flex items-center justify-center text-text-3 hover:text-text-1 transition-all shrink-0"
                      title="Visit site"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="px-4 py-1.5 rounded-lg bg-green text-bg-0 text-[12.5px] font-semibold hover:bg-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {publishing ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Publishing...
                      </>
                    ) : deployUrl ? (
                      <>
                        <RefreshCw size={13} />
                        Update
                      </>
                    ) : (
                      'Publish'
                    )}
                  </button>
                  {timeAgo && (
                    <span className="text-[11px] text-text-3">Last published {timeAgo}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pb-12" />
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
