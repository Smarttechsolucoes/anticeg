// Entrada própria da página de PILOTO de senhas (/piloto-senha/). O site principal (index.html → main.jsx → App.jsx) não é carregado aqui
// e esta página não é carregada pelo site principal: as duas não se enxergam.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PilotoSenha from './PilotoSenha.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PilotoSenha />
  </StrictMode>,
)
