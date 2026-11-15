import { useEffect, useRef } from 'react'
import type { BlockConfig, CalendarEvent } from '../types'
import { useEditorStore } from '@/store/editorStore'
import { connectCalendar } from './calendar-view.js'

const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const timeLabel = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
const controlClass = 'min-h-10 rounded-md border border-[#BBC8D0] bg-white px-3 text-sm font-semibold text-[#24354A] hover:bg-[#EDF3F7]'

export function CalendarBlock({ block, editable = false }: { block: BlockConfig; editable?: boolean }) {
  const calendar = useRef<HTMLElement>(null)
  useEffect(() => {
    if (calendar.current) return connectCalendar(calendar.current)
  }, [])

  const title = typeof block.props.title === 'string' && block.props.title.trim() ? block.props.title.trim() : 'Calendar'
  const intro = typeof block.props.intro === 'string' ? block.props.intro : ''
  const events = (Array.isArray(block.props.events) ? block.props.events as CalendarEvent[] : []).filter(event => {
    if (typeof event?.title !== 'string' || !event.title.trim() || typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return false
    const date = new Date(event.date + 'T00:00:00Z')
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === event.date
  }).sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')))

  return <section ref={calendar} data-ws-calendar aria-label={title} className="bg-[#F5F7F5] text-[#24354A]">
    <header className="bg-[#252F42] px-6 py-8 text-center text-[#FFF7E7]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#DDC493]">Parish life</p>
      <h1 className="text-3xl font-semibold @lg:text-4xl">{title}</h1>
      {intro && <p className="mx-auto mt-2 max-w-xl text-sm text-[#E1E8EF]">{intro}</p>}
      {editable && <button type="button" className="mt-4 rounded border border-[#BBC8D0] px-3 py-1.5 text-sm hover:bg-white/10" onClick={() => {
        useEditorStore.getState().selectBlock(block.id)
        document.querySelector<HTMLButtonElement>('[aria-label="Expand right panel"]')?.click()
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-properties-tab]')?.click())
      }}>Manage events</button>}
    </header>
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 @min-[760px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @lg:px-8 @lg:py-8">
      <div data-ws-calendar-month hidden className="min-w-0 rounded-xl border border-[#D6E0E5] bg-white p-3 @lg:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 data-ws-calendar-label aria-live="polite" className="text-lg font-semibold" />
          <div className="flex gap-1.5">
            <button data-ws-block-button type="button" data-ws-calendar-step="-1" aria-label="Previous month" className={controlClass}>‹</button>
            <button data-ws-block-button type="button" data-ws-calendar-step="0" className={controlClass}>This month</button>
            <button data-ws-block-button type="button" data-ws-calendar-step="1" aria-label="Next month" className={controlClass}>›</button>
          </div>
        </div>
        <table aria-label="Month calendar" className="w-full table-fixed text-center text-sm">
          <thead><tr>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <th key={day} scope="col" className="pb-2 text-xs font-semibold text-[#435567]">{day}</th>)}</tr></thead>
          <tbody data-ws-calendar-days />
        </table>
      </div>
      <div className="min-w-0 rounded-xl border border-[#D6E0D7] bg-[#E8EFE8] p-4 @lg:p-5">
        <h2 className="text-lg font-semibold text-[#2D4B39]">Events</h2>
        <p data-ws-calendar-empty hidden={events.length > 0} className="mt-3 text-sm text-[#344A40]">No events are scheduled for this month.</p>
        <ol data-ws-calendar-events className="mt-2 divide-y divide-[#CBD8CC]">
          {events.map((event, index) => {
            const time = typeof event.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time) ? event.time : ''
            const location = typeof event.location === 'string' ? event.location.trim() : ''
            return <li key={event.id || index} data-ws-event-date={event.date} className="py-3">
              <p className="text-xs font-semibold text-[#395745]">
                <time dateTime={time ? `${event.date}T${time}` : event.date}>
                  {dateLabel.format(new Date(event.date + 'T00:00:00Z'))}{time ? ' · ' + timeLabel.format(new Date('2000-01-01T' + time + ':00Z')) : ''}
                </time>
              </p>
              <h3 className="mt-1 break-words font-semibold">{event.title.trim()}</h3>
              {location && <p className="mt-0.5 break-words text-sm text-[#344A40]">{location}</p>}
              {typeof event.details === 'string' && event.details.trim() && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#344A40]">{event.details.trim()}</p>}
            </li>
          })}
        </ol>
      </div>
    </div>
  </section>
}
