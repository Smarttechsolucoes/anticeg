import { PREVIEW_INERTE } from './supabase.js'

// Preview da Vercel sem banco configurado: faixa fixa avisando que nada ali lê nem grava dados reais
export default function FaixaPreview() {
  if (!PREVIEW_INERTE) return null
  return (
    <div data-testid="faixa-preview-inerte" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999, background: '#b45309', color: '#fff', textAlign: 'center', fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', letterSpacing: 1, pointerEvents: 'none' }}>
      PREVIEW · SEM BANCO · nenhuma leitura ou gravação de dados reais
    </div>
  )
}
