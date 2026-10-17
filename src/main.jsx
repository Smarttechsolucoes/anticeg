import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AMBIENTE_ENSAIO } from './supabase.js'

// Em ambiente de ENSAIO (projeto Supabase separado), uma faixa fixa avisa que nada ali é real
const FaixaEnsaio = () => AMBIENTE_ENSAIO ? (
  <div data-testid="faixa-ensaio" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999, background: '#b45309', color: '#fff', textAlign: 'center', fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', letterSpacing: 1, pointerEvents: 'none' }}>
    AMBIENTE DE ENSAIO · dados fictícios · nada aqui é real
  </div>
) : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FaixaEnsaio />
    <App />
  </StrictMode>,
)
