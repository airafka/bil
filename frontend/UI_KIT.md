# Fields

Field styling is based on the user-provided @alabuga/uikit 17.3.1 archive: InputText/styles.ts, DropDown/Select, FieldWrapper, icons/ChevronIcon.tsx and tokens/tokens.json. The supplied Figma screenshot defines horizontal labels and two-column sections.

MVP uses React 19; the supplied library has React 18, Router 6 and MUI 6 peer dependencies. FormControls adapts its visual contract to native React controls, preserving existing validation and keyboard behavior without installing the full library. No archive build/publish scripts are used.

Use UiInput, UiSelect and UiTextarea from components/FormControls. Use .field.horizontal-field and .form-fields-grid / .form-fields-column for forms. Tables use 32px controls; forms use 40px. ui-kit-tokens.css contains extracted colors and radius. form-controls.css owns all shared states and responsive field layout.
