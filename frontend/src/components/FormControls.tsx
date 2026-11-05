import { useEffect, useId, useRef, useState, type ComponentPropsWithRef } from 'react'

// Native semantics keep keyboard, form and validation behavior; select-controls.css styles every picker.
// Visual states and dimensions follow @alabuga/uikit 17.3.1 InputText / Select.
export function UiInput({ className = '', type = 'text', ...props }: ComponentPropsWithRef<'input'>) {
  const choice = type === 'checkbox' || type === 'radio'
  return <input {...props} type={type} className={`${choice ? 'ui-choice' : 'ui-control'} ${className}`} />
}
export function UiSelect({ className = '', value, onKeyDown, ...props }: ComponentPropsWithRef<'select'>) {
  return <select {...props} value={value} onKeyDown={event => {
    if (event.key === 'Escape' && event.currentTarget.matches(':open')) event.stopPropagation()
    onKeyDown?.(event)
  }} data-placeholder={value === '' || value == null} className={`ui-control ui-select ${className}`} />
}
export function UiTextarea({ className = '', ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} className={`ui-control ${className}`} />
}

// Multi-selection uses the shared field shell and standard UiInput checkboxes.
export function UiMultiSelect({ options, value, onChange, disabled, ...props }: {
  options: { value: string; label: string }[]; value: string[];
  onChange: (value: string[]) => void; disabled?: boolean;
  'aria-label'?: string; 'aria-labelledby'?: string;
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const blocked = disabled || !options.length
  const summary = value.map(item => options.find(option => option.value === item)?.label ?? item).join(', ')
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="ui-multi-select" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); event.stopPropagation() }
  }}>
    <button {...props} ref={trigger} type="button" className="ui-control ui-select ui-multi-trigger" disabled={blocked} aria-expanded={open && !blocked} aria-controls={panelId} title={summary} onClick={() => setOpen(current => !current)}>{summary}</button>
    {open && !blocked && <div id={panelId} className="ui-multi-options" role="group" {...props}>
      {options.map(option => <label className="ui-multi-option" data-selected={value.includes(option.value)} key={option.value}>
        <UiInput type="checkbox" checked={value.includes(option.value)} onChange={event => onChange(event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))} />
        <span>{option.label}</span>
      </label>)}
    </div>}
  </div>
}
