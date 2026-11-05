import { UiSelect } from './FormControls'

export function WrappingSelect({ options, value, onChange, disabled=false, label, labelledBy, required=false }: {
  options: { value:string; label:string }[]; value:string; onChange:(value:string)=>void;
  disabled?:boolean; label:string; labelledBy?:string; required?:boolean
}) {
  return <UiSelect aria-label={label} aria-labelledby={labelledBy} required={required}
    value={value} disabled={disabled || !options.length} onChange={event => onChange(event.target.value)}>
    <option value="" disabled hidden />
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </UiSelect>
}
