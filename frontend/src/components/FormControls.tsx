import type { ComponentPropsWithRef } from 'react'

// Native controls keep the MVP's keyboard, form and validation behavior.
// Visual states and dimensions follow @alabuga/uikit 17.3.1 InputText / Select.
export function UiInput({ className = '', type = 'text', ...props }: ComponentPropsWithRef<'input'>) {
  const choice = type === 'checkbox' || type === 'radio'
  return <input {...props} type={type} className={`${choice ? 'ui-choice' : 'ui-control'} ${className}`} />
}
export function UiSelect({ className = '', value, ...props }: ComponentPropsWithRef<'select'>) {
  return <select {...props} value={value} data-placeholder={value === '' || value == null} className={`ui-control ui-select ${className}`} />
}
export function UiTextarea({ className = '', ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} className={`ui-control ${className}`} />
}
