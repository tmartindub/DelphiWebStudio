import type { BlockType } from './types'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'image' | 'link' | 'textarea' | 'select' | 'checkbox' | 'array-strings' | 'array-items'
  options?: string[]
}

export const blockFields: Partial<Record<BlockType, { sections: { title: string; fields: FieldDef[] }[] }>> = {
  collage: { sections: [{ title: 'Collage photos', fields: [{ key: 'images', label: 'Photos and image layers', type: 'array-items' }] }] },
  panel: { sections: [{ title: 'Panel content', fields: [
    { key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Text', type: 'textarea' },
    { key: 'src', label: 'Image', type: 'image' }, { key: 'alt', label: 'Image description', type: 'text' },
  ] }, { title: 'Panel position', fields: [
    { key: 'layoutWidth', label: 'Width (% of page)', type: 'text' }, { key: 'layoutHeight', label: 'Height (px)', type: 'text' },
    { key: 'layoutLeft', label: 'Left (% of page)', type: 'text' }, { key: 'layoutTop', label: 'Vertical offset (px)', type: 'text' },
    { key: 'layoutLayer', label: 'Layer order', type: 'text' },
  ] }] },
  document: { sections: [{ title: 'Document', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  documentLibrary: { sections: [{ title: 'Document library', fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'items', label: 'Documents', type: 'array-items' }] }] },
  calendar: { sections: [{ title: 'Calendar heading', fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'intro', label: 'Introduction', type: 'textarea' }] }] },
  audio: { sections: [{ title: 'Audio', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  mediaVideo: { sections: [{ title: 'Video', fields: [{ key: 'title', label: 'Title', type: 'text' }] }] },
  pdfViewer: { sections: [{ title: 'PDF', fields: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'accessibilityLabel', label: 'Accessibility label', type: 'text' },
    { key: 'height', label: 'Height (px)', type: 'text' },
    { key: 'initialPage', label: 'Starting page', type: 'text' },
    { key: 'fitMode', label: 'Fit mode', type: 'select', options: ['auto', 'width', 'page'] },
    { key: 'mobileMode', label: 'Mobile display', type: 'select', options: ['viewer', 'link'] },
    { key: 'showThumbnails', label: 'Show page thumbnails', type: 'checkbox' },
    { key: 'showSearch', label: 'Show search', type: 'checkbox' },
    { key: 'showPrint', label: 'Show print link', type: 'checkbox' },
    { key: 'showDownload', label: 'Show download link', type: 'checkbox' },
    { key: 'showFullscreen', label: 'Show fullscreen', type: 'checkbox' },
  ] }] },
  navbar: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'logo', label: 'Logo Text', type: 'text' },
          { key: 'ctaText', label: 'CTA Button', type: 'text' },
          { key: 'logoImage', label: 'Logo Image URL', type: 'image' },
          { key: 'ctaUrl', label: 'CTA Destination', type: 'link' },
          { key: 'links', label: 'Legacy text-only labels', type: 'array-strings' },
          { key: 'navItems', label: 'Navigation destinations', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['default', 'centered'] },
          { key: 'layoutWidth', label: 'Navbar width (% of page)', type: 'text' },
          { key: 'layoutHeight', label: 'Navbar height (px)', type: 'text' },
        ],
      },
    ],
  },
  hero: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'badge', label: 'Badge', type: 'text' },
          { key: 'headline', label: 'Headline', type: 'text' },
          { key: 'subheadline', label: 'Subheadline', type: 'textarea' },
          { key: 'primaryCta', label: 'Primary CTA', type: 'text' },
          { key: 'primaryCtaUrl', label: 'Primary CTA URL', type: 'link' },
          { key: 'secondaryCta', label: 'Secondary CTA', type: 'text' },
          { key: 'secondaryCtaUrl', label: 'Secondary CTA URL', type: 'link' },
          { key: 'heroImage', label: 'Hero Image URL', type: 'image' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['centered', 'split', 'gradient', 'minimal'] },
          { key: 'layoutWidth', label: 'Hero width (% of page)', type: 'text' },
          { key: 'layoutHeight', label: 'Hero height (px)', type: 'text' },
        ],
      },
    ],
  },
  features: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'label', label: 'Section Label', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
      },
      {
        title: 'Items',
        fields: [
          { key: 'items', label: 'Feature Cards', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'list', 'alternating'] },
        ],
      },
    ],
  },
  pricing: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'comparison'] },
        ],
      },
    ],
  },
  cta: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'headline', label: 'Headline', type: 'text' },
          { key: 'subheadline', label: 'Subheadline', type: 'text' },
          { key: 'buttonText', label: 'Button Text', type: 'text' },
          { key: 'buttonUrl', label: 'Button URL', type: 'link' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'split'] },
        ],
      },
    ],
  },
  footer: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'logo', label: 'Logo Text', type: 'text' },
          { key: 'logoImage', label: 'Logo Image URL', type: 'image' },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'copyright', label: 'Copyright', type: 'text' },
          { key: 'links', label: 'Legacy text-only labels', type: 'array-strings' },
          { key: 'navItems', label: 'Navigation destinations', type: 'array-items' },
          { key: 'resources', label: 'Resource images and links', type: 'array-items' },
          { key: 'resourceButtons', label: 'Resource buttons', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['simple', 'multi-column', 'minimal', 'resources'] },
        ],
      },
    ],
  },
  testimonials: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'items', label: 'Testimonials', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['cards', 'carousel', 'spotlight'] },
        ],
      },
    ],
  },
  stats: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'items', label: 'Stats', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'bar', 'counter'] },
        ],
      },
    ],
  },
  faq: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'items', label: 'Questions', type: 'array-items' },
        ],
      },
    ],
  },
  team: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'members', label: 'Members', type: 'array-items' },
        ],
      },
    ],
  },
  contact: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'recipientEmail', label: 'Contact Email', type: 'text' },
          { key: 'formEndpoint', label: 'Form service HTTPS URL (optional)', type: 'text' },
          { key: 'consentNotice', label: 'Privacy and consent notice (optional)', type: 'textarea' },
        ],
      },
    ],
  },
  newsletter: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'buttonText', label: 'Button Text', type: 'text' },
          { key: 'socialProof', label: 'Social Proof', type: 'text' },
        ],
      },
    ],
  },
  logocloud: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'logos', label: 'Logos', type: 'array-strings' },
        ],
      },
    ],
  },
  content: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'body', label: 'Body', type: 'textarea' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['prose', 'wide-prose', 'columns', 'highlight'] },
        ],
      },
    ],
  },
  image: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'src', label: 'Image URL', type: 'image' },
          { key: 'alt', label: 'Alt Text', type: 'text' },
          { key: 'pageHeading', label: 'Page heading', type: 'text' },
          { key: 'imageLink', label: 'Image link', type: 'link' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'subtitle', label: 'Subtitle', type: 'text' },
          { key: 'imageSide', label: 'Image Side', type: 'select', options: ['left', 'right'] },
        ],
      },
      {
        title: 'Grid Images',
        fields: [
          { key: 'images', label: 'Images', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['hero-image', 'side-by-side', 'grid'] },
          { key: 'imageFit', label: 'Image fit', type: 'select', options: ['cover', 'contain', 'fill'] },
          { key: 'layoutWidth', label: 'Section width (% of page)', type: 'text' },
          { key: 'layoutHeight', label: 'Image height (px)', type: 'text' },
          { key: 'layoutLeft', label: 'Left position (% of page)', type: 'text' },
          { key: 'layoutTop', label: 'Vertical spacing (px; negative overlaps)', type: 'text' },
          { key: 'layoutLayer', label: 'Layer order', type: 'text' },
        ],
      },
    ],
  },
  video: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'url', label: 'Video URL', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Platform', type: 'select', options: ['youtube', 'vimeo'] },
        ],
      },
    ],
  },
  gallery: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'enablePhotoViewer', label: 'Open enlarged photos on double-click', type: 'checkbox' },
          { key: 'images', label: 'Images', type: 'array-items' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['grid', 'masonry', 'responsive'] },
        ],
      },
    ],
  },
  divider: {
    sections: [
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['line', 'space', 'dots'] },
          { key: 'width', label: 'Width', type: 'select', options: ['full', 'centered', 'narrow'] },
          { key: 'height', label: 'Height (px)', type: 'text' },
        ],
      },
    ],
  },
  banner: {
    sections: [
      {
        title: 'Content',
        fields: [
          { key: 'text', label: 'Text', type: 'text' },
          { key: 'linkText', label: 'Link Text', type: 'text' },
          { key: 'linkUrl', label: 'Link URL', type: 'link' },
        ],
      },
      {
        title: 'Style',
        fields: [
          { key: 'variant', label: 'Variant', type: 'select', options: ['ribbon', 'bar'] },
        ],
      },
    ],
  },
}
