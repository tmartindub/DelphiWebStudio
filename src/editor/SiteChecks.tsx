import { useEffect, useRef, useState } from 'react'
import { useConfigStore } from '@/store/configStore'
import { useEditorStore } from '@/store/editorStore'
import { checkSite, type SiteIssue } from '@/project/site-checks'
import { validateProjectMedia } from '@/project/project-file'
import { ProjectMediaLibrary, type MediaAsset } from '@/media/media-library'
import { useProjectsStore } from '@/store/projectsStore'

export function SiteChecks({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const config = useConfigStore(state => state.config)
  const projectId = useEditorStore(state => state.activeProjectId)
  const mediaBusy = useEditorStore(state => state.mediaImporting)
  const revision = useProjectsStore(state => state.projects.find(project => project.id === projectId)?.mediaRevision ?? 0)
  const [media, setMedia] = useState<{ projectId: string; revision: number; assets?: MediaAsset[]; error?: string } | null>(null)
  let issues: SiteIssue[] = []
  let error = ''
  try { issues = checkSite(config) } catch (cause) { error = cause instanceof Error ? cause.message : 'The site could not be checked.' }
  const mediaReady = !mediaBusy && !!projectId && media?.projectId === projectId && media.revision === revision
  let mediaError = mediaReady ? media?.error ?? '' : ''
  if (!error && mediaReady && media?.assets) {
    try { validateProjectMedia(config, media.assets) } catch (cause) { mediaError = cause instanceof Error ? cause.message : 'Project media could not be checked.' }
  }

  useEffect(() => {
    if (!projectId || mediaBusy) return
    let active = true
    new ProjectMediaLibrary().list(projectId).then(assets => {
      if (active) setMedia({ projectId, revision, assets })
    }).catch(() => { if (active) setMedia({ projectId, revision, error: 'Project media could not be read.' }) })
    return () => { active = false }
  }, [projectId, revision, mediaBusy])

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose() }} aria-labelledby="site-checks-title" className="w-[min(92vw,38rem)] max-h-[85vh] rounded-xl border border-border-default bg-bg-1 p-5 text-text-0 shadow-xl backdrop:bg-black/60">
      <h2 id="site-checks-title" className="text-lg font-semibold">Check site</h2>
      <p className="mt-2 text-sm text-text-2">Checks project media, missing media sources, known button links, text-only navigation, image descriptions and form configuration. No website is published or contacted.</p>
      {!mediaReady && <p role="status" className="mt-3 text-sm">Checking project media…</p>}
      {mediaError && <p role="alert" className="mt-3 text-sm text-status-red">{mediaError}</p>}
      {error ? <p role="alert" className="mt-4 text-sm text-status-red">{error}</p> : issues.length ? <ul className="mt-4 space-y-2">
        {issues.map((issue, index) => <li key={`${issue.pageId}-${issue.blockId}-${index}`} className="rounded border border-border-default bg-bg-2 p-3 text-sm">
          <p><strong>{issue.pageName}:</strong> {issue.message}</p>
          <button type="button" className="mt-2 text-green underline" onClick={() => { useConfigStore.getState().setActivePage(issue.pageId); useEditorStore.getState().selectBlock(issue.blockId); onClose() }}>Open this block</button>
        </li>)}
      </ul> : mediaReady && !mediaError ? <p className="mt-4 text-sm">No issues found in these checks.</p> : null}
      <p className="mt-4 text-xs text-text-2">External links, anchors, custom blocks, visual layout and overall accessibility are not verified. Review and test the exported website as well.</p>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded border border-border-default px-3 py-2 text-sm">Close</button></div>
    </dialog>
  )
}
