import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import FaixaPreview from './FaixaPreview.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FaixaPreview />
    <App />
  </StrictMode>,
)
