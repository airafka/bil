export function ActionIcon({ name }: { name: 'plus' | 'edit' | 'more' | 'close' }) {
  return <svg className="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'plus' && <path d="M12 5v14M5 12h14" />}
    {name === 'edit' && <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z" /></>}
    {name === 'more' && <><circle cx="5" cy="12" r=".75" fill="currentColor" /><circle cx="12" cy="12" r=".75" fill="currentColor" /><circle cx="19" cy="12" r=".75" fill="currentColor" /></>}
    {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
  </svg>
}
