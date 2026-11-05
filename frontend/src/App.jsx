import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Compass, GraduationCap, LayoutDashboard, LoaderCircle, MapPin, Menu, Plus, RefreshCw, Search, Sparkles, Ticket, Users, X } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'discover', label: 'Discover events', icon: Compass },
  { id: 'registrations', label: 'My registrations', icon: Ticket },
  { id: 'organizer', label: 'Host events', icon: Users },
]
const palette = ['#cce9e3', '#dce7fa', '#ffe6d5', '#e9e0fa', '#fff1c9', '#d5eaf3']

function parseDate(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
function dateLabel(value, options = { month: 'short', day: 'numeric' }) {
  const d = parseDate(value)
  return d ? new Intl.DateTimeFormat('en', options).format(d) : 'Date to be announced'
}
function timeLabel(value) {
  const d = parseDate(value)
  return d ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(d) : 'Time TBA'
}
function normalizeList(data) { return Array.isArray(data) ? data : data?.events || data?.registrations || data?.attendees || [] }
function titleCase(value = '') { return value.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function initials(email = '?') { return email.split('@')[0].split(/[._-]/).map(x => x[0]).join('').slice(0, 2).toUpperCase() }
function useStored(key, fallback) {
  const [value, setValue] = useState(() => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback } })
  const save = next => { setValue(next); try { localStorage.setItem(key, JSON.stringify(next)) } catch {} }
  return [value, save]
}

export default function App() {
  const [users, setUsers] = useStored('cc-demo-users', [])
  const [activeId, setActiveId] = useStored('cc-active-user-id', '')
  const activeUser = users.find(user => String(user.id) === String(activeId)) || null
  const [page, setPage] = useState('dashboard')
  const [events, setEvents] = useState([])
  const [eventStatus, setEventStatus] = useState('loading')
  const [registrations, setRegistrations] = useState([])
  const [registrationStatus, setRegistrationStatus] = useState('idle')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All events')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [toast, setToast] = useState(null)
  const [userModal, setUserModal] = useState(false)
  const [eventModal, setEventModal] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [attendeeEventId, setAttendeeEventId] = useState('')
  const [attendees, setAttendees] = useState([])
  const [attendeeStatus, setAttendeeStatus] = useState('idle')
  const [attendeeQuery, setAttendeeQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState('')

  const request = useCallback(async (path, options = {}) => {
    if (!API_BASE) throw new Error('API address is missing. Set VITE_API_BASE_URL and restart the app.')
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } })
    let payload
    try { payload = await response.json() } catch { payload = null }
    if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`)
    return payload
  }, [])

  const loadEvents = useCallback(async () => {
    setEventStatus('loading'); setApiError('')
    try { const data = await request('/api/events'); setEvents(normalizeList(data)); setEventStatus('ready') }
    catch (error) { setEventStatus('error'); setApiError(error.message) }
  }, [request])
  const loadRegistrations = useCallback(async (userId = activeId) => {
    if (!userId) { setRegistrations([]); setRegistrationStatus('ready'); return }
    setRegistrationStatus('loading')
    try { const data = await request(`/api/me/registrations?user_id=${encodeURIComponent(userId)}`); setRegistrations(normalizeList(data)); setRegistrationStatus('ready') }
    catch (error) { setRegistrationStatus('error'); setApiError(error.message) }
  }, [activeId, request])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadRegistrations(activeId) }, [activeId, loadRegistrations])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 4000); return () => clearTimeout(id) }, [toast])

  const eventsById = useMemo(() => new Map(events.map(event => [String(event.id), event])), [events])
  const registeredIds = useMemo(() => new Set(registrations.map(row => String(row.event_id ?? row.event?.id))), [registrations])
  const validEvents = events.filter(event => parseDate(event.timestamp) && parseDate(event.timestamp) >= new Date())
  const filteredEvents = events.filter(event => {
    const text = `${event.title || ''} ${event.description || ''} ${event.category || ''} ${event.location || ''}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (category === 'All events' || (event.category || 'Campus').toLowerCase() === category.toLowerCase())
  }).sort((a, b) => (parseDate(a.timestamp)?.getTime() || 0) - (parseDate(b.timestamp)?.getTime() || 0))
  const upcoming = validEvents.slice(0, 3)
  const organizerEvents = events.filter(event => String(event.organiser_id ?? event.organizer_id) === String(activeId))
  const selectedAttendeeEvent = eventsById.get(String(attendeeEventId))

  function notify(message, type = 'success') { setToast({ message, type }) }
  async function createUser(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    setBusy(true)
    try {
      const result = await request('/api/users', { method: 'POST', body: JSON.stringify({ email }) })
      if (!result?.id || !result?.email || !result?.role) throw new Error('The API response must include id, email, and role.')
      const user = { id: result.id, email: result.email, role: result.role }
      setUsers(prev => [...prev.filter(item => String(item.id) !== String(user.id)), user]); setActiveId(user.id)
      setUserModal(false); setPage('dashboard'); notify('Your demo user is ready. User data was saved to the database.')
    } catch (error) { notify(error.message, 'error') }
    finally { setBusy(false) }
  }
  async function createEvent(event) {
    event.preventDefault()
    if (!activeUser) { notify('Create a student user before hosting an event.', 'error'); setUserModal(true); return }
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await request('/api/events', { method: 'POST', body: JSON.stringify({
        title: String(form.get('title') || '').trim(),
        timestamp: new Date(String(form.get('timestamp'))).toISOString(),
        capacity: String(form.get('capacity') || ''),
        organiser_id: activeUser.id,
      }) })
      await loadEvents()
      setEventModal(false); setPage('organizer'); setAttendeeEventId(String(result.id)); setAttendees([]); setAttendeeStatus('ready')
      notify('Your event is live and saved to the database.')
    } catch (error) { notify(error.message, 'error') }
    finally { setBusy(false) }
  }
  async function registerForEvent(event) {
    if (!activeUser) { notify('Create a demo user before registering.', 'error'); setUserModal(true); return }
    setBusy(true)
    try {
      await request('/api/registrations', { method: 'POST', body: JSON.stringify({ user_id: activeUser.id, event_id: event.id }) })
      notify('You’re registered. See you there!'); await loadRegistrations(activeUser.id); await loadEvents()
    } catch (error) { notify(error.message, 'error') }
    finally { setBusy(false) }
  }
  async function loadAttendees(eventId) {
    if (!eventId) { setAttendees([]); setAttendeeStatus('idle'); return }
    setAttendeeStatus('loading')
    try { const data = await request(`/api/events/${encodeURIComponent(eventId)}/registrations`); setAttendees(normalizeList(data)); setAttendeeStatus('ready') }
    catch (error) { setAttendeeStatus('error'); setApiError(error.message) }
  }
  function openOrganizer() { setPage('organizer'); setMobileNav(false); if (!attendeeEventId && organizerEvents[0]) { setAttendeeEventId(String(organizerEvents[0].id)); loadAttendees(organizerEvents[0].id) } }
  function changePage(id) { setPage(id); setMobileNav(false); if (id === 'discover') loadEvents(); if (id === 'registrations') loadRegistrations() }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#overview" onClick={e => { e.preventDefault(); changePage('dashboard') }}><span className="brand-mark"><GraduationCap size={22} strokeWidth={2.2} /></span><span>campus<span className="brand-light">connect</span></span></a>
      <div className="campus-tag"><span className="campus-dot" /> YOUR CAMPUS, IN SYNC</div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">{NAV.map(item => <button className={`nav-item ${page === item.id ? 'nav-active' : ''}`} key={item.id} onClick={() => changePage(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === 'registrations' && registrations.length > 0 && <span className="nav-count">{registrations.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-spark"><Sparkles size={16} /></div><strong>Make campus yours.</strong><p>Find your people at your next favorite event.</p><button onClick={() => changePage('discover')}>Explore events <ArrowRight size={14} /></button></div><div className="sidebar-foot">Made for the moments<br />between classes <span>✳</span></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="breadcrumb">Campus life <ChevronRight size={14} /> <strong>{NAV.find(n => n.id === page)?.label || 'Attendee management'}</strong></div><div className="topbar-actions"><span className="date-today">{dateLabel(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })}</span><button className="icon-button notification-button" aria-label="Refresh events" title="Refresh events" onClick={loadEvents}><RefreshCw size={17} /></button><div className="user-wrap"><button className="user-trigger" onClick={() => setUserMenu(!userMenu)} aria-expanded={userMenu}><span className="avatar">{activeUser ? initials(activeUser.email) : <Users size={16} />}</span><span className="user-trigger-copy"><b>{activeUser?.email?.split('@')[0] || 'Choose a user'}</b><small>{activeUser ? 'Student' : 'Demo user switching'}</small></span><ChevronDown size={15} /></button>{userMenu && <div className="user-popover"><div className="popover-heading">DEMO USER SWITCHER</div><p className="popover-note">Switching users is for preview only. This is not authentication.</p>{users.map(user => <button className={`switch-user ${String(user.id) === String(activeId) ? 'switch-selected' : ''}`} key={user.id} onClick={() => { setActiveId(user.id); setUserMenu(false); setPage('dashboard'); notify(`Switched to ${user.email}`) }}><span className="avatar avatar-small">{initials(user.email)}</span><span><b>{user.email}</b><small>Student</small></span>{String(user.id) === String(activeId) && <Check size={15} />}</button>)}<button className="add-user-link" onClick={() => { setUserMenu(false); setUserModal(true) }}><Plus size={16} /> Create a demo user</button>{users.length === 0 && <p className="popover-empty">No demo users saved on this device yet.</p>}</div>}</div></div></header>
      <div className="content-wrap">
        {page === 'dashboard' && <Dashboard activeUser={activeUser} events={events} upcoming={upcoming} registrations={registrations} registrationStatus={registrationStatus} eventStatus={eventStatus} onNavigate={changePage} onOpen={setSelectedEvent} onCreate={() => setUserModal(true)} registeredIds={registeredIds} />}
        {page === 'discover' && <section><PageHeading eyebrow="FIND YOUR NEXT THING" title="Discover events" description="Good things happen when you show up." action={<button className="button button-quiet" onClick={loadEvents}><RefreshCw size={15} /> Refresh</button>} /><div className="filter-bar"><label className="search-box"><Search size={17} /><input aria-label="Search events" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search events, topics, places..." /></label><select aria-label="Filter event category" value={category} onChange={e => setCategory(e.target.value)}><option>All events</option>{[...new Set(events.map(e => e.category).filter(Boolean))].map(item => <option key={item}>{titleCase(item)}</option>)}</select><span className="results-count">{filteredEvents.length} events</span></div>{eventStatus === 'loading' ? <LoadingState label="Finding campus events" /> : eventStatus === 'error' ? <ErrorState message={apiError} onRetry={loadEvents} /> : filteredEvents.length === 0 ? <EmptyState icon={Compass} title={query ? 'No events match that search' : 'Nothing on the calendar just yet'} text={query ? 'Try a different title or category.' : 'Check back soon. New campus events will show up here.'} /> : <div className="event-grid">{filteredEvents.map((event, i) => <EventCard key={event.id} event={event} index={i} registered={registeredIds.has(String(event.id))} onOpen={setSelectedEvent} />)}</div>}</section>}
        {page === 'registrations' && <section><PageHeading eyebrow="YOUR CAMPUS CALENDAR" title="My registrations" description="All the events you’ve got coming up, in one place." action={<span className="soft-pill"><Ticket size={14} /> {registrations.length} saved</span>} />{!activeUser ? <NoUser onCreate={() => setUserModal(true)} /> : registrationStatus === 'loading' ? <LoadingState label="Loading your registrations" /> : registrationStatus === 'error' ? <ErrorState message={apiError} onRetry={() => loadRegistrations()} /> : registrations.length === 0 ? <EmptyState icon={CalendarDays} title="A little room in your calendar" text="You haven’t registered for anything yet. Your next favorite thing is out there." action={<button className="button button-primary" onClick={() => changePage('discover')}>Explore events <ArrowRight size={15} /></button>} /> : <div className="registration-list">{registrations.map((row, i) => { const event = eventsById.get(String(row.event_id ?? row.event?.id)) || row.event || {}; return <RegistrationRow key={row.id || `${row.event_id}-${i}`} row={row} event={event} onOpen={setSelectedEvent} /> })}</div>}</section>}
        {page === 'organizer' && <section>
          <PageHeading eyebrow="YOUR CAMPUS EVENTS" title="Host an event" description="Create something for your campus community." action={activeUser && <button className="button button-primary" onClick={() => setEventModal(true)}><Plus size={15} /> Create event</button>} />
          {!activeUser ? <NoUser onCreate={() => setUserModal(true)} /> : <>
            <div className="organizer-stat-row">
              <StatCard label="Events you host" value={eventStatus === 'loading' ? '—' : organizerEvents.length} icon={CalendarDays} trend="Created by you" />
              <StatCard label="Total registrations" value={organizerEvents.reduce((sum, e) => sum + Number(e.registration_count ?? e.registrations_count ?? 0), 0)} icon={Users} trend="Across your events" />
              <StatCard label="Host account" value={activeUser.email} icon={Sparkles} trend="Student account" />
            </div>
            {eventStatus === 'loading' ? <LoadingState label="Loading your events" /> : eventStatus === 'error' ? <ErrorState message={apiError} onRetry={loadEvents} /> : organizerEvents.length === 0
              ? <EmptyState icon={CalendarDays} title="Your event lineup starts here" text="Host your first event and it will appear here." action={<button className="button button-primary" onClick={() => setEventModal(true)}><Plus size={15} /> Create event</button>} />
              : <div className="organizer-layout"><div className="organizer-event-list"><h2 className="section-heading">Events you host <span>{organizerEvents.length}</span></h2>{organizerEvents.map(event => <button key={event.id} className="organizer-event" onClick={() => { setAttendeeEventId(String(event.id)); loadAttendees(event.id) }}><span className="event-date-block"><b>{dateLabel(event.timestamp, { day: '2-digit' })}</b><small>{dateLabel(event.timestamp, { month: 'short' })}</small></span><span className="organizer-event-copy"><b>{event.title}</b><small>{timeLabel(event.timestamp)} · {event.location || 'Campus'}</small></span><span className="organizer-event-count">{event.registration_count ?? event.registrations_count ?? '—'}<small>joined</small></span></button>)}</div><AttendeePanel event={selectedAttendeeEvent} attendees={attendees} status={attendeeStatus} query={attendeeQuery} setQuery={setAttendeeQuery} onRetry={() => loadAttendees(attendeeEventId)} /></div>}
          </>}
        </section>}
        {page === 'attendees' && <section><button className="back-link" onClick={openOrganizer}><ChevronLeft size={16} /> Back to hosted events</button><AttendeePanel event={selectedAttendeeEvent} attendees={attendees} status={attendeeStatus} query={attendeeQuery} setQuery={setAttendeeQuery} onRetry={() => loadAttendees(attendeeEventId)} /></section>}
        <footer className="page-footer"><span>© 2026 CampusConnect</span><span>Built for the moments that bring us together <span className="footer-star">✳</span></span></footer>
      </div>
    </main>
    {selectedEvent && <EventDialog event={eventsById.get(String(selectedEvent.id)) || selectedEvent} registered={registeredIds.has(String(selectedEvent.id))} busy={busy} onClose={() => setSelectedEvent(null)} onRegister={() => registerForEvent(selectedEvent)} />}
    {userModal && <UserDialog busy={busy} onClose={() => setUserModal(false)} onSubmit={createUser} />}
    {eventModal && <EventFormDialog busy={busy} onClose={() => setEventModal(false)} onSubmit={createEvent} />}
    {toast && <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === 'success' ? <Check size={17} /> : <X size={17} />}</span>{toast.message}<button aria-label="Dismiss message" onClick={() => setToast(null)}><X size={15} /></button></div>}
  </div>
}

function PageHeading({ eyebrow, title, description, action }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div> }
function Dashboard({ activeUser, events, upcoming, registrations, registrationStatus, eventStatus, onNavigate, onOpen, onCreate, registeredIds }) {
  const firstName = activeUser?.email?.split('@')[0]?.split(/[._-]/)[0]
  return <><section className="welcome-banner"><div className="welcome-copy"><div className="welcome-eyebrow"><Sparkles size={14} /> A LITTLE MORE CAMPUS, A LITTLE LESS SCROLLING</div><h1>{activeUser ? <>Hey, {titleCase(firstName)}. <span>Your campus is calling.</span></> : <>Your campus is calling.<br /><span>Come see what’s happening.</span></>}</h1><p>Find a new favorite, meet your people, make the most of being here.</p><button className="button button-dark" onClick={() => onNavigate('discover')}>Explore what’s on <ArrowRight size={16} /></button></div><div className="welcome-art" aria-hidden="true"><div className="sun-disc"/><div className="art-card art-card-one"><CalendarDays size={19}/><span><b>Something good</b><small>is on the calendar</small></span></div><div className="art-card art-card-two"><span className="mini-avatars"><i/><i/><i/></span><span><b>Your people</b><small>are already going</small></span></div><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span></div></section>
    {!activeUser && <div className="demo-user-callout"><span className="callout-icon"><Users size={19} /></span><div><b>Pick a demo user to get started</b><p>Switch between student accounts. This demo switcher is not sign-in.</p></div><button className="button button-primary" onClick={onCreate}>Create demo user <Plus size={15} /></button></div>}
    <div className="dashboard-stats"><StatCard label="Your registrations" value={registrationStatus === 'loading' ? '—' : registrations.length} icon={Ticket} trend={registrations.length ? 'Looking forward to it' : 'Room for something new'} /><StatCard label="Events coming up" value={eventStatus === 'loading' ? '—' : upcoming.length} icon={CalendarDays} trend="Around your campus" /><StatCard label="Campus happenings" value={eventStatus === 'loading' ? '—' : events.length} icon={Activity} trend="A little something for everyone" /></div>
    <section className="dashboard-section"><div className="section-top"><div><div className="eyebrow">DON’T MISS A THING</div><h2>Coming up on campus</h2></div><button className="text-link" onClick={() => onNavigate('discover')}>See all events <ArrowRight size={15}/></button></div>{eventStatus === 'loading' ? <div className="inline-loading"><LoaderCircle className="spin" size={19}/> Finding what’s happening…</div> : eventStatus === 'error' ? <div className="inline-error">Couldn’t load events. Try refreshing the event list.</div> : upcoming.length === 0 ? <EmptyState icon={CalendarDays} title="The calendar is taking a breather" text="When a new event is added, it’ll be waiting here." action={<button className="button button-primary" onClick={() => onNavigate('discover')}>Browse events <ArrowRight size={15}/></button>} compact /> : <div className="event-grid">{upcoming.map((event, i) => <EventCard key={event.id} event={event} index={i} registered={registeredIds.has(String(event.id))} onOpen={onOpen} />)}</div>}</section>
    <div className="dashboard-lower"><section className="registration-summary"><div className="section-top compact-top"><div><div className="eyebrow">YOUR NEXT CHAPTER</div><h2>Registration summary</h2></div><button className="mini-arrow" aria-label="View all registrations" onClick={() => onNavigate('registrations')}><ArrowUpRight size={17}/></button></div>{registrationStatus === 'loading' ? <div className="inline-loading"><LoaderCircle className="spin" size={18}/> Loading your plans…</div> : registrations.length ? registrations.slice(0, 2).map((row, i) => { const event = eventOf(row, events); return <div className="summary-event" key={row.id || i}><span className="summary-date"><b>{dateLabel(event.timestamp, { day: '2-digit' })}</b><small>{dateLabel(event.timestamp, { month: 'short' })}</small></span><span><b>{event.title || 'Campus event'}</b><small>{timeLabel(event.timestamp)}</small></span><Check className="summary-check" size={16}/></div> }) : <div className="summary-empty"><span className="summary-ticket"><Ticket size={18}/></span><p>{activeUser ? 'Your next event is one discovery away.' : 'Choose a demo user to see registrations.'}</p><button className="text-link" onClick={() => onNavigate(activeUser ? 'discover' : 'dashboard')}>{activeUser ? 'Find an event' : 'Get started'} <ArrowRight size={14}/></button></div>}</section><section className="discover-note"><div className="note-top"><span className="note-icon"><Compass size={19}/></span><span className="note-kicker">A FRIENDLY NUDGE</span></div><h3>The best plans<br/>are the ones you<br/><em>didn’t overthink.</em></h3><p>There’s something happening on campus with your name on it.</p><button className="note-link" onClick={() => onNavigate('discover')}>Take a look <ArrowRight size={14}/></button><span className="note-decoration" aria-hidden="true">✳</span></section></div>
  </>
}
function eventOf(row, events) { return events.find(e => String(e.id) === String(row.event_id ?? row.event?.id)) || row.event || {} }
function StatCard({ label, value, icon: Icon, trend }) { return <div className="stat-card"><div className="stat-card-top"><span>{label}</span><span className="stat-icon"><Icon size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-trend"><ArrowDownRight size={13}/>{trend}</div></div> }
function EventCard({ event, index = 0, registered, onOpen }) {
  const date = parseDate(event.timestamp), capacity = Number(event.capacity), count = Number(event.registration_count ?? event.registrations_count ?? 0)
  const full = Number.isFinite(capacity) && capacity > 0 && count >= capacity
  const category = titleCase(event.category || ['Campus life', 'Community', 'Learning'][index % 3])
  return <article className="event-card"><button className="event-card-main" onClick={() => onOpen(event)} aria-label={`View ${event.title || 'event'} details`}><div className="event-art" style={{ '--art-color': palette[index % palette.length] }}><span className="event-art-label">{category}</span><span className="art-number">0{index + 1}</span><span className="art-illustration">{index % 3 === 0 ? '✳' : index % 3 === 1 ? '◌' : '✿'}</span><span className="event-date-chip"><b>{date ? new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date) : '—'}</b><small>{date ? new Intl.DateTimeFormat('en', { month: 'short' }).format(date) : 'TBA'}</small></span></div><div className="event-card-copy"><h3>{event.title || 'Campus gathering'}</h3><p className="event-description">{event.description || 'A chance to connect, try something new, and make your campus feel a little smaller.'}</p><div className="event-meta"><span><Clock3 size={14}/>{date ? `${dateLabel(event.timestamp)} · ${timeLabel(event.timestamp)}` : 'Date to be announced'}</span><span><MapPin size={14}/>{event.location || 'On campus'}</span></div></div></button><div className="event-card-footer"><span className={`capacity-state ${full ? 'capacity-full' : ''}`}>{full ? 'Event full' : `${count}${Number.isFinite(capacity) && capacity > 0 ? ` / ${capacity}` : ''} registered`}</span><button className={`event-action ${registered ? 'event-action-done' : ''}`} onClick={() => onOpen(event)}>{registered ? <><Check size={14}/> Registered</> : <>{full ? 'View details' : 'Details'} <ArrowRight size={14}/></>}</button></div></article>
}
function RegistrationRow({ row, event, onOpen }) { return <article className="registration-row"><span className="registration-date"><b>{dateLabel(event.timestamp, { day: '2-digit' })}</b><small>{dateLabel(event.timestamp, { month: 'short' })}</small></span><div className="registration-info"><h3>{event.title || 'Campus event'}</h3><p><CalendarDays size={14}/>{dateLabel(event.timestamp, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })} <span>·</span><Clock3 size={14}/>{timeLabel(event.timestamp)}</p><small>Registered {dateLabel(row.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><button className="button button-outline" onClick={() => onOpen(event)}>Event details <ArrowRight size={14}/></button></article> }
function AttendeePanel({ event, attendees, status, query, setQuery, onRetry }) {
  const filtered = attendees.filter(row => (row.email || row.user?.email || '').toLowerCase().includes(query.toLowerCase()))
  return <section className="attendee-panel"><div className="attendee-header"><div><div className="eyebrow">EVENT ATTENDANCE</div><h2>{event?.title || 'Choose an event'}</h2><p>{event ? `${dateLabel(event.timestamp, { weekday: 'long', month: 'long', day: 'numeric' })} · Capacity ${event.capacity ?? 'not set'}` : 'Select an event from your hosted events.'}</p></div>{event && <span className="soft-pill"><Users size={14}/>{attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}</span>}</div>{event && <><label className="search-box attendee-search"><Search size={16}/><input aria-label="Search attendees by email" placeholder="Search attendee email..." value={query} onChange={e => setQuery(e.target.value)}/></label>{status === 'loading' ? <LoadingState label="Loading attendee list" /> : status === 'error' ? <ErrorState message="Couldn’t load attendee registrations." onRetry={onRetry} /> : filtered.length === 0 ? <EmptyState icon={Users} title={attendees.length ? 'No attendee matches that email' : 'No registrations yet'} text={attendees.length ? 'Try another email address.' : 'When students register, they’ll appear here.'} /> : <div className="attendee-table-wrap"><table className="attendee-table"><thead><tr><th>ATTENDEE</th><th>REGISTERED</th><th>STATUS</th></tr></thead><tbody>{filtered.map((row, i) => { const email = row.email || row.user?.email || row.user_email || 'Email unavailable'; return <tr key={row.id || i}><td><span className="attendee-person"><span className="avatar avatar-small">{initials(email)}</span><b>{email}</b></span></td><td>{dateLabel(row.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><span className="attending-badge"><i/> Registered</span></td></tr> })}</tbody></table></div>}</>}</section>
}
function LoadingState({ label }) { return <div className="state-card"><LoaderCircle className="spin state-icon" size={23}/><b>{label}</b><span>Just a moment.</span></div> }
function ErrorState({ message, onRetry }) { return <div className="state-card error-state"><span className="state-icon"><Activity size={23}/></span><b>We couldn’t load this right now</b><span>{message || 'Check that the API is available and try again.'}</span>{onRetry && <button className="button button-outline" onClick={onRetry}><RefreshCw size={14}/> Try again</button>}</div> }
function EmptyState({ icon: Icon, title, text, action, compact = false }) { return <div className={`state-card empty-state ${compact ? 'state-compact' : ''}`}><span className="state-icon"><Icon size={22}/></span><b>{title}</b><span>{text}</span>{action}</div> }
function NoUser({ onCreate }) { return <EmptyState icon={Users} title="Choose who’s using CampusConnect" text="Create a student account to register for events or host one. Demo user switching is not sign-in." action={<button className="button button-primary" onClick={onCreate}>Create demo user <Plus size={15}/></button>} /> }
function EventDialog({ event, registered, busy, onClose, onRegister }) {
  const capacity = Number(event.capacity), count = Number(event.registration_count ?? event.registrations_count ?? 0), full = Number.isFinite(capacity) && capacity > 0 && count >= capacity
  useEffect(() => { const fn = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title"><button className="modal-close" aria-label="Close event details" onClick={onClose}><X size={19}/></button><div className="modal-event-art" style={{ '--art-color': palette[(String(event.id).length || 0) % palette.length] }}><span className="art-illustration">✳</span><span className="modal-date"><b>{dateLabel(event.timestamp, { day: '2-digit' })}</b><small>{dateLabel(event.timestamp, { month: 'short' })}</small></span></div><div className="modal-body"><span className="eyebrow">{titleCase(event.category || 'CAMPUS EVENT')}</span><h2 id="event-modal-title">{event.title}</h2><p className="modal-description">{event.description || 'Come along, meet someone new, and spend time doing something you enjoy.'}</p><div className="detail-facts"><div><CalendarDays size={17}/><span><b>{dateLabel(event.timestamp, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</b><small>{timeLabel(event.timestamp)}</small></span></div><div><Users size={17}/><span><b>{full ? 'Event is full' : `${count} registered${Number.isFinite(capacity) && capacity > 0 ? ` · ${capacity - count} spots left` : ''}`}</b><small>{Number.isFinite(capacity) && capacity > 0 ? `${capacity} person capacity` : 'Capacity not listed'}</small></span></div>{(event.organiser_id || event.organizer_id) && <div><GraduationCap size={17}/><span><b>Event host</b><small>Hosted by a student in your campus community</small></span></div>}</div><button className={`button ${registered || full ? 'button-outline' : 'button-primary'} modal-register`} disabled={registered || full || busy} onClick={onRegister}>{busy ? <LoaderCircle className="spin" size={16}/> : registered ? <Check size={16}/> : null}{busy ? 'Saving your place…' : registered ? 'You’re registered' : full ? 'This event is full' : 'Register for this event'}{!registered && !full && !busy && <ArrowRight size={16}/>}</button></div></section></div>
}
function UserDialog({ busy, onClose, onSubmit }) { return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="modal user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"><button className="modal-close" aria-label="Close new demo user form" onClick={onClose}><X size={19}/></button><span className="create-user-mark"><Users size={21}/></span><div className="eyebrow">A QUICK CAMPUS PREVIEW</div><h2 id="user-modal-title">Create a demo user</h2><p className="user-modal-intro">Create a student profile in the connected database. You can use this account to register for events or host one.</p><form onSubmit={onSubmit}><label className="form-label" htmlFor="new-user-email">Email address</label><input className="form-input" id="new-user-email" name="email" type="email" required placeholder="you@university.edu"/><p className="form-hint">All demo accounts are students. Any student can register for events or host an event.</p><p className="form-hint">This submits to <code>POST /api/users</code>. The user is only added to your switcher after the API saves it successfully.</p><button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Saving to database…</> : <>Create and switch user <ArrowRight size={16}/></>}</button></form></section></div> }

function EventFormDialog({ busy, onClose, onSubmit }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="modal user-modal event-form-modal" role="dialog" aria-modal="true" aria-labelledby="event-form-title"><button className="modal-close" aria-label="Close create event form" onClick={onClose}><X size={19}/></button><span className="create-user-mark"><CalendarDays size={21}/></span><div className="eyebrow">BRING CAMPUS TOGETHER</div><h2 id="event-form-title">Create an event</h2><p className="user-modal-intro">Your student account will be saved as the event host.</p><form onSubmit={onSubmit}>
    <label className="form-label" htmlFor="event-title">Event title</label><input className="form-input" id="event-title" name="title" required maxLength="120" placeholder="e.g. Campus game night"/>
    <label className="form-label" htmlFor="event-timestamp">Date and time</label><input className="form-input" id="event-timestamp" name="timestamp" type="datetime-local" required min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}/>
    <label className="form-label" htmlFor="event-capacity">Capacity <span className="optional-label">(optional)</span></label><input className="form-input" id="event-capacity" name="capacity" type="number" min="1" step="1" placeholder="Leave blank for no limit"/>
    <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16}/> Saving event…</> : <>Create event <ArrowRight size={16}/></>}</button>
  </form></section></div>
}
