import type { BlockConfig } from '../types'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

interface ContactProps {
  title?: string
  subtitle?: string
  recipientEmail?: string
  formEndpoint?: string
}

export function ContactBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as ContactProps
  const recipient = typeof props.recipientEmail === 'string' ? props.recipientEmail.trim() : ''
  const endpoint = typeof props.formEndpoint === 'string' ? props.formEndpoint.trim() : ''
  let validEndpoint = false
  try { const url = new URL(endpoint); validEndpoint = !/[\s\p{Cc}]/u.test(endpoint) && url.protocol === 'https:' && !url.username && !url.password && !url.hash } catch { /* no valid endpoint */ }
  const configured = endpoint ? validEndpoint : /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(recipient)

  return (
    <section className="px-6 @md:px-10 py-16 @md:py-20">
      <div className="max-w-lg mx-auto">
        <div className="reveal-fade-up reveal-d1 text-center mb-8">
          <h2 className="text-2xl @md:text-3xl font-bold tracking-tight mb-2">
            {props.title || 'Get in Touch'}
          </h2>
          {props.subtitle && (
            <p className="text-text-2 text-sm">{props.subtitle}</p>
          )}
        </div>

        <form onSubmit={event => { event.preventDefault(); toast(endpoint ? 'Preview only: the exported form sends to the configured service.' : 'Preview only: the exported form opens the visitor’s email application.') }}>
        <fieldset disabled={!configured} className="reveal-fade-up reveal-d2 space-y-4">
          <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] text-text-2 mb-1.5 font-medium">Name
              <input
                type="text"
                name="name" required maxLength={200}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors"
              />
              </label>
            </div>
            <div>
              <label className="block text-[11.5px] text-text-2 mb-1.5 font-medium">Email
              <input
                type="email"
                name="email" required maxLength={254}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 transition-colors"
              />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-[11.5px] text-text-2 mb-1.5 font-medium">Message
            <textarea
              rows={4}
              name="message" required maxLength={4000}
              placeholder="How can we help?"
              className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-bg-2 text-text-0 text-[13px] outline-none focus:border-green placeholder:text-text-3 resize-y transition-colors"
            />
            </label>
          </div>
          <button
            className="w-full py-3 rounded-lg bg-green text-black text-sm font-semibold hover:bg-green-dim transition-all hover:accent-glow-lg flex items-center justify-center gap-2"
          >
            <Send size={14} />
            Send Message
          </button>
        </fieldset>
        </form>
        <p className="text-text-1 text-sm mt-3">{configured ? (endpoint ? 'This form sends the visitor’s information to the configured service.' : 'This form opens the visitor’s email application; the visitor sends the message there.') : 'This form is not connected yet. Add a valid contact email or HTTPS form service URL in Properties.'}</p>
      </div>
    </section>
  )
}
