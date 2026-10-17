// Trava de build para PREVIEWS da Vercel (VERCEL_ENV=preview) e builds marcados como ensaio (AMBIENTE_ENSAIO=1). Roda antes do "vite build" (veja package.json).
// Produção da Vercel e uso local normal: não muda nada (sai com 0 sem olhar nada).
//
// Preview SEM variáveis de Supabase  -> PERMITIDO e INERTE: o site sai sem banco (endereço .invalid, veja src/ambiente.js); não é preciso outro projeto Supabase.
// Preview COM variáveis (projeto de ensaio opcional) -> a trava confere: URL e chave NÃO podem ser da produção, a chave tem de ser a pública (anon) e URL e chave têm de ser do mesmo projeto.
const PRODUCAO = "ghjfsmwwcfpfvrouyrka";
const ensaio = process.env.VERCEL_ENV === "preview" || process.env.AMBIENTE_ENSAIO === "1";
if (!ensaio) process.exit(0);

const url = process.env.VITE_SUPABASE_URL || "", chave = process.env.VITE_SUPABASE_ANON_KEY || "";
const erro = m => { console.error(`\n✖ BUILD DE PREVIEW RECUSADO: ${m}\n  Remova VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY do ambiente "Preview" da Vercel (o preview sai inerte, sem banco) ou aponte-as para um projeto Supabase de ENSAIO.\n`); process.exit(1); };

if (!url && !chave) {
  console.log("✔ Preview INERTE: sem variáveis de Supabase, o site sai sem banco (nenhuma leitura nem gravação de dados reais).");
  process.exit(0);
}
if (!url || !chave) erro("só uma das variáveis (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) foi definida.");
if (url.includes(PRODUCAO)) erro("VITE_SUPABASE_URL aponta para o projeto de PRODUÇÃO.");
let payload = {};
try { payload = JSON.parse(Buffer.from(chave.split(".")[1], "base64url").toString()); } catch { erro("VITE_SUPABASE_ANON_KEY não parece uma chave do Supabase."); }
if (payload.ref === PRODUCAO) erro("VITE_SUPABASE_ANON_KEY é a chave do projeto de PRODUÇÃO.");
if (payload.ref && !url.includes(payload.ref)) erro("a chave e a URL são de projetos diferentes.");
if (payload.role && payload.role !== "anon") erro(`a chave informada é "${payload.role}", não a pública (anon). Nunca coloque a chave de serviço no site.`);
console.log(`✔ Preview aponta para ${new URL(url).host} (não é a produção).`);
