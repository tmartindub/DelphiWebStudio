import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { Toaster } from 'sonner'
import { ShortcutsModal } from '@/editor/ShortcutsModal'
import { configDraftReadFailed } from '@/store/configStore'
import { projectDraftReadFailed } from '@/store/projectsStore'

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <TopNav />
      {(configDraftReadFailed || projectDraftReadFailed) && <div role="alert" className="mt-12 bg-status-yellow text-black px-4 py-2 text-sm">Local drafts could not be read. Existing drafts are protected from overwrite; save any new work to a separate project file and restart to retry.</div>}
      <main id="main-content" className={`flex-1 overflow-hidden ${(configDraftReadFailed || projectDraftReadFailed) ? '' : 'mt-12'}`} role="main">
        <div key={location.pathname} className="h-full animate-fade-in-up">
          <Outlet />
        </div>
      </main>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--color-bg-3)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-0)',
            fontSize: '13px',
          },
        }}
      />
      <ShortcutsModal />
    </div>
  )
}
