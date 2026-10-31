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
  const content: Record<(typeof templateMeta)[number]['id'], string> = {
    personal: '## About me\n\nShare your story here.\n\n## Interests\n\nDescribe the things you enjoy.',
    portfolio: '## About my work\n\nIntroduce your work here.\n\n## Selected projects\n\nDescribe the projects you would like to share.',
    community: '## About our community\n\nIntroduce your group here.\n\n## Get involved\n\nExplain how people can participate.',
    church: '## About our church\n\nIntroduce your church here.\n\n## Visiting\n\nAdd information for visitors.',
    school: '## About our club\n\nIntroduce your school group here.\n\n## Activities\n\nDescribe what your group does.',
    business: '## About our business\n\nIntroduce your business here.\n\n## What we do\n\nDescribe your services or work.',
    documentation: '## Getting started\n\nAdd an introduction here.\n\n## Guides\n\nDescribe the information visitors can find.',
    blog: '## About this blog\n\nIntroduce your writing here.\n\n## Recent writing\n\nAdd an introduction to your articles.',
  }
  return {
    name: siteName,
    blocks: [
      { id: `block-${crypto.randomUUID()}`, type: 'hero', variant: 'minimal', props: { headline: siteName, subheadline: selectedTemplate.description, primaryCta: '' } },
      { id: `block-${crypto.randomUUID()}`, type: 'content', variant: 'prose', props: { body: content[selectedTemplate.id] } },
    ],
  }
}

export function getTemplateForPrompt(prompt: string): SiteConfig {
  const lowercasePrompt = prompt.toLowerCase()
  const selectedTemplate = templateMeta.find(template => template.keywords.some(keyword => lowercasePrompt.includes(keyword))) ?? templateMeta[0]
  const siteName = prompt.trim().split(/\s+/).slice(0, 4).join(' ') || 'My Website'
  return buildTemplate(selectedTemplate.id, siteName)
}
