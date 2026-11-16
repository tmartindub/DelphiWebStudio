import { useState, useEffect, useRef } from 'react'
import {
  Settings2, Search as SearchIcon, Key, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useProjectsStore, type ProjectSettings } from '@/store/projectsStore'
import { useEditorStore } from '@/store/editorStore'
import { geminiSession } from '@/lib/generate-site'
import { requestGeminiCredential } from '@/desktop/native-bridge'

type SettingsTab = 'general' | 'seo' | 'api'

const tabDefs: { value: SettingsTab; label: string; icon: typeof Settings2 }[] = [
  { value: 'general', label: 'Project settings', icon: Settings2 },
  { value: 'seo', label: 'SEO', icon: SearchIcon },
  { value: 'api', label: 'Application settings', icon: Key },
]

function useSettingsState() {
  const activeProjectId = useEditorStore((s) => s.activeProjectId)
  const projects = useProjectsStore((s) => s.projects)
  const updateProjectSettings = useProjectsStore((s) => s.updateProjectSettings)

  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
  const projectSettings = activeProject?.settings || {}

  const [showSaved, setShowSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const data: Record<string, string> = Object.fromEntries(
    Object.entries(projectSettings).map(([k, v]) => [k, v || ''])
  )

  const update = (key: string, value: string) => {
    if (activeProjectId) {
      updateProjectSettings(activeProjectId, { [key]: value } as Partial<ProjectSettings>)
    }
    setShowSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setShowSaved(false), 2000)
  }

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current) }
  }, [])

  return { data, update, showSaved }
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-[11.5px] text-text-2 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  )
}

function ControlledInput({ settingsKey, placeholder, settings }: { settingsKey: string; placeholder?: string; settings: ReturnType<typeof useSettingsState> }) {
  return (
    <input
      type="text"
      value={settings.data[settingsKey] || ''}
      placeholder={placeholder}
      onChange={(e) => settings.update(settingsKey, e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors"
    />
  )
}

function ControlledTextarea({ settingsKey, rows = 3, settings }: { settingsKey: string; rows?: number; settings: ReturnType<typeof useSettingsState> }) {
  return (
    <textarea
      value={settings.data[settingsKey] || ''}
      rows={rows}
      onChange={(e) => settings.update(settingsKey, e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green resize-y transition-colors"
    />
  )
}

function GeneralPanel({ settings }: { settings: ReturnType<typeof useSettingsState> }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Project settings</h2><p className="mb-5 text-sm text-text-2">These values are saved with this project.</p>
      <FieldGroup label="Site Name"><ControlledInput settingsKey="siteName" settings={settings} /></FieldGroup>
      <FieldGroup label="Webmaster contact email">
        <input type="email" aria-label="Webmaster contact email" value={settings.data.webmasterEmail || ''}
          onChange={event => settings.update('webmasterEmail', event.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green" />
        <p className="text-[11px] text-text-3 mt-1.5">Default for contact forms without their own email. A form service URL takes precedence.</p>
      </FieldGroup>
      <FieldGroup label="Site Description"><ControlledTextarea settingsKey="siteDescription" settings={settings} /></FieldGroup>
      <FieldGroup label="Favicon URL"><ControlledInput settingsKey="faviconUrl" placeholder="https://example.com/favicon.ico" settings={settings} /></FieldGroup>
      <FieldGroup label="Site search">
        <select aria-label="Site search" value={settings.data.siteSearch || 'off'} onChange={event => settings.update('siteSearch', event.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green">
          <option value="off">Off</option><option value="on">Include in website ZIP</option>
        </select>
        <p className="text-[11px] text-text-3 mt-1.5">Searches page titles and supported text in the exported site. It does not search inside PDFs.</p>
      </FieldGroup>
      <FieldGroup label="Language">
        <select
          value={settings.data.language || 'English'}
          onChange={(e) => settings.update('language', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green cursor-pointer"
        >
          <option>English</option><option>German</option><option>Spanish</option><option>French</option>
        </select>
      </FieldGroup>
    </div>
  )
}

function SeoPanel({ settings }: { settings: ReturnType<typeof useSettingsState> }) {
  const title = settings.data.seoTitle || settings.data.siteName || 'Your site title'
  const description = settings.data.seoDescription || settings.data.siteDescription || 'Add a description for your site.'
  const domain = settings.data.siteBaseUrl || 'Set a public site URL when you know it.'

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">SEO</h2>
      <FieldGroup label="Page Title"><ControlledInput settingsKey="seoTitle" settings={settings} /></FieldGroup>
      <FieldGroup label="Meta Description"><ControlledTextarea settingsKey="seoDescription" settings={settings} /></FieldGroup>
      <FieldGroup label="Public site URL (optional)">
        <ControlledInput settingsKey="siteBaseUrl" placeholder="https://example.com/" settings={settings} />
        <p className="text-[11px] text-text-3 mt-1.5">When set, ZIP export includes a sitemap and canonical page addresses. Include the subfolder if your site will use one.</p>
      </FieldGroup>
      <FieldGroup label="OG Image URL"><ControlledInput settingsKey="ogImageUrl" placeholder="https://example.com/og.png" settings={settings} /></FieldGroup>

      {/* Live Google preview */}
      <div className="mt-6 p-4 rounded-xl bg-bg-2 border border-border-default">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-3 mb-3">Google Preview</div>
        <div className="text-[#8ab4f8] text-sm hover:underline cursor-pointer">{title}</div>
        <div className="text-[#bdc1c6] text-[11px] mt-0.5">{domain}</div>
        <div className="text-[#9aa0a6] text-[11.5px] mt-1 leading-relaxed">
          {description}
        </div>
      </div>
    </div>
  )
}

function ApiPanel({ settings }: { settings: ReturnType<typeof useSettingsState> }) {
  const [geminiKey, setGeminiKey] = useState(geminiSession.changed ? geminiSession.key : localStorage.getItem('openpage-gemini-key') || '')
  const [legacyKeySaved, setLegacyKeySaved] = useState(() => !!localStorage.getItem('openpage-gemini-key'))
  const [secureSaved, setSecureSaved] = useState(false)
  const [secureAvailable, setSecureAvailable] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const keyEdited = useRef(false)
  useEffect(() => {
    let mounted = true
    requestGeminiCredential('read').then(key => {
      if (!mounted || key === null) return
      setSecureAvailable(true)
      setSecureSaved(!!key)
      if (key && !keyEdited.current && !geminiSession.changed) setGeminiKey(key)
    }).catch(() => { if (mounted) toast.error('Could not read the saved Google key from Windows Credential Manager.') })
    return () => { mounted = false }
  }, [])
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [cloudEnabled, setCloudEnabled] = useState(geminiSession.cloudEnabled)
  const activeProjectId = useEditorStore(state => state.activeProjectId)
  const deploymentKeys = useEditorStore(state => state.deploymentKeys)
  const setDeploymentKey = useEditorStore(state => state.setDeploymentKey)
  const hasSessionDeployKey = !!activeProjectId && Object.hasOwn(deploymentKeys, activeProjectId)
  const deployKey = activeProjectId && hasSessionDeployKey ? deploymentKeys[activeProjectId] : settings.data.deployAccessKey || ''

  function handleKeyChange(value: string) {
    keyEdited.current = true
    setGeminiKey(value)
    geminiSession.key = value
    geminiSession.changed = true
  }

  async function handleTest() {
    if (!geminiKey) return
    setTesting(true)
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': geminiKey } },
      )
      if (res.ok) {
        toast.success('API key is valid')
      } else {
        toast.error(`Invalid key: ${res.status}`)
      }
    } catch {
      toast.error('Connection failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Application settings</h2><p className="mb-5 text-sm text-text-2">Your saved Google key is available across projects for this Windows account.</p>

      <label className="mb-5 flex items-start gap-2 text-xs text-text-1">
        <input type="checkbox" checked={cloudEnabled} onChange={event => { geminiSession.cloudEnabled = event.target.checked; setCloudEnabled(event.target.checked) }} />
        <span>Allow cloud AI generation for this session. A generation brief may be sent to Google or the configured server. This setting resets when the app closes or reloads.</span>
      </label>

      <h3 className="mb-3 text-sm font-semibold">Current project hosting connection</h3><FieldGroup label="Deploy Access Key">
        <input
          type="password"
          aria-label="Deploy Access Key"
          value={deployKey}
          disabled={!activeProjectId}
          placeholder="Must match OPENPAGE_DEPLOY_KEY on server"
          onChange={event => { if (activeProjectId) setDeploymentKey(activeProjectId, event.target.value) }}
          className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green disabled:opacity-50"
        />
        <p className="text-[11px] text-text-3 mt-1.5">
          New entries are held in memory for this project until the app closes or reloads.
        </p>
        {activeProjectId && settings.data.deployAccessKey && <div className="text-[11px] text-status-yellow mt-1.5">
          <p>An older key is still stored in project settings without application-level encryption. It is not removed automatically.</p>
          <button type="button" className="underline" onClick={() => {
            setDeploymentKey(activeProjectId, deployKey)
            settings.update('deployAccessKey', '')
            toast('Saved deployment key removed. The current entry remains available until the app closes or reloads.')
          }}>Remove older saved deployment key</button>
        </div>}
      </FieldGroup>

      <h3 className="mb-3 mt-6 text-sm font-semibold">Application-wide AI connection</h3><FieldGroup label="Gemini API Key">
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={geminiKey}
            placeholder="AIza..."
            onChange={(e) => handleKeyChange(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors font-mono"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 rounded-lg border border-border-default bg-bg-2 text-text-2 text-[12px] hover:text-text-0 hover:bg-bg-3 transition-colors shrink-0"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={handleTest}
            disabled={!geminiKey || testing}
            className="px-3 py-2 rounded-lg bg-green/10 text-green text-[12px] font-medium hover:bg-green/20 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
        <p className="text-[11px] text-text-3 mt-1.5">
          Used for selected-text writing assistance and optional site generation. Get one at{' '}
          <span className="text-text-2">aistudio.google.com</span>
        </p>
        <p className="text-[11px] text-text-3 mt-1.5">{secureAvailable ? 'Save this key securely for your Windows account and reuse it in all projects.' : 'A key can be saved in Windows Credential Manager when using the desktop application.'}</p>
        {secureAvailable && <div className="flex gap-3 mt-2">
          <button type="button" disabled={!geminiKey.trim() || savingKey} className="underline disabled:opacity-40" onClick={async () => {
            setSavingKey(true)
            try { await requestGeminiCredential('write', geminiKey.trim()); geminiSession.key = geminiKey.trim(); geminiSession.changed = true; setSecureSaved(true); toast.success('Google key saved for this Windows user.') }
            catch { toast.error('Could not save the Google key in Windows Credential Manager.') }
            finally { setSavingKey(false) }
          }}>Save key</button>
          {secureSaved && <button type="button" disabled={savingKey} className="underline" onClick={async () => {
            setSavingKey(true)
            try { await requestGeminiCredential('delete'); handleKeyChange(''); setSecureSaved(false); toast('Saved Google key removed.') }
            catch { toast.error('Could not remove the saved Google key.') }
            finally { setSavingKey(false) }
          }}>Remove saved key</button>}
        </div>}
        {legacyKeySaved && <div className="text-[11px] text-status-yellow mt-1.5">
          <p>An older key is still stored without application-level encryption. It is not removed automatically.</p>
          <button type="button" className="underline" onClick={() => {
            try {
              localStorage.removeItem('openpage-gemini-key')
              geminiSession.key = geminiKey
              geminiSession.changed = true
              setLegacyKeySaved(false)
              toast('Saved key removed. The current entry remains available until the app closes or reloads.')
            } catch { toast.error('The saved key could not be removed.') }
          }}>Remove older saved key</button>
        </div>}
      </FieldGroup>

    </div>
  )
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const settings = useSettingsState()

  const panels: Record<SettingsTab, React.ReactNode> = {
    general: <GeneralPanel settings={settings} />,
    seo: <SeoPanel settings={settings} />,
    api: <ApiPanel settings={settings} />,
  }

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <div className="md:w-52 bg-bg-1 border-b md:border-b-0 md:border-r border-border-default p-2 shrink-0 flex md:flex-col gap-1 overflow-x-auto">
        {tabDefs.map(({ value, label, icon: Icon }, i) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            style={{ animationDelay: `${i * 40}ms` }}
            className={`shrink-0 md:w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] transition-all text-left animate-fade-in-up ${
              activeTab === value
                ? 'bg-bg-3 text-text-0'
                : 'text-text-2 hover:text-text-0 hover:bg-bg-2'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl relative">
        {settings.showSaved && (
          <div className="absolute top-3 right-6 flex items-center gap-1.5 text-green text-[11px] animate-fade-in">
            <Check size={12} />
            Draft updated
          </div>
        )}
        <div key={activeTab} className="animate-fade-in-up">
          {panels[activeTab]}
        </div>
      </div>
    </div>
  )
}
