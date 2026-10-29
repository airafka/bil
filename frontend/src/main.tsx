import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './ui-kit-tokens.css'
import './form-controls.css'
import './service-table.css'
import './routes.css'
import './complex-service.css'
import './design-system.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

