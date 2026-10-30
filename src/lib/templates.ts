import type { SiteConfig } from '@/blocks/types'

export const templateMeta = [
  { id: 'personal', name: 'Personal', description: 'Share your interests and story', accent: '#0757b8', blockCount: 2, icon: 'Briefcase', keywords: ['personal', 'hobby', 'family'] },
  { id: 'portfolio', name: 'Portfolio', description: 'Present your work', accent: '#f28a25', blockCount: 2, icon: 'Briefcase', keywords: ['portfolio', 'photography', 'designer'] },
  { id: 'community', name: 'Community', description: 'Connect a community or club', accent: '#0757b8', blockCount: 2, icon: 'Building2', keywords: ['community', 'club', 'organization'] },
  { id: 'church', name: 'Church', description: 'Share church information', accent: '#f28a25', blockCount: 2, icon: 'Building2', keywords: ['church', 'congregation', 'ministry'] },
  { id: 'school', name: 'School club', description: 'Introduce a school group', accent: '#0757b8', blockCount: 2, icon: 'BookOpen', keywords: ['school', 'student', 'class'] },
  { id: 'business', name: 'Business', description: 'Describe an informational business', accent: '#f28a25', blockCount: 2, icon: 'Building2', keywords: ['business', 'company', 'professional'] },
  { id: 'documentation', name: 'Documentation', description: 'Organize helpful information', accent: '#0757b8', blockCount: 2, icon: 'BookOpen', keywords: ['documentation', 'guide', 'help'] },
  { id: 'blog', name: 'Blog', description: 'Start a writing site', accent: '#f28a25', blockCount: 2, icon: 'BookOpen', keywords: ['blog', 'articles', 'writing'] },
] as const

export function buildTemplate(id: string, name: string): SiteConfig {
  const selectedTemplate = templateMeta.find(template => template.id === id) ?? templateMeta[0]
  const siteName = name.trim() || 'My Website'
  return {
    name: siteName,
    blocks: [
      { id: `block-${crypto.randomUUID()}`, type: 'hero', variant: 'minimal', props: { headline: siteName, subheadline: selectedTemplate.description, primaryCta: '' } },
      { id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'prose', props: { body: '## About\n\nAdd your own information here.' } },
    ],
  }
}

export function getTemplateForPrompt(prompt: string): SiteConfig {
  const lowercasePrompt = prompt.toLowerCase()
  const selectedTemplate = templateMeta.find(template => template.keywords.some(keyword => lowercasePrompt.includes(keyword))) ?? templateMeta[0]
  const siteName = prompt.trim().split(/\s+/).slice(0, 4).join(' ') || 'My Website'
  return buildTemplate(selectedTemplate.id, siteName)
}
