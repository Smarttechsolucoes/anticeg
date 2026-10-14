// Trava de build: um build de PREVIEW da Vercel (ou qualquer build marcado como ensaio) NUNCA pode sair apontando para o Supabase de produção.
// Roda antes do "vite build" (veja package.json). Na produção da Vercel (VERCEL_ENV=production) e no uso local normal, não muda nada.
//   VERCEL_ENV=preview  -> exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY de um projeto DIFERENTE da produção.
//   AMBIENTE_ENSAIO=1   -> mesma exigência (para builds de teste fora da Vercel).
const PRODUCAO = "ghjfsmwwcfpfvrouyrka";
const ensaio = process.env.VERCEL_ENV === "preview" || process.env.AMBIENTE_ENSAIO === "1";
if (!ensaio) process.exit(0);

const url = process.env.VITE_SUPABASE_URL || "", chave = process.env.VITE_SUPABASE_ANON_KEY || "";
const erro = m => { console.error(`\n✖ BUILD DE ENSAIO RECUSADO: ${m}\n  Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (projeto Supabase de ENSAIO) nas variáveis de ambiente "Preview" da Vercel.\n  Guia: supabase/ensaio/GUIA.md\n`); process.exit(1); };
if (!url || !chave) erro("faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (sem elas o site usaria o banco de PRODUÇÃO).");
if (url.includes(PRODUCAO)) erro("VITE_SUPABASE_URL aponta para o projeto de PRODUÇÃO.");
try { const ref = JSON.parse(Buffer.from(chave.split(".")[1], "base64url").toString()).ref; if (ref === PRODUCAO) erro("VITE_SUPABASE_ANON_KEY é a chave do projeto de PRODUÇÃO."); if (ref && !url.includes(ref)) erro("a chave e a URL são de projetos diferentes."); } catch { erro("VITE_SUPABASE_ANON_KEY não parece uma chave do Supabase."); }
const role = (() => { try { return JSON.parse(Buffer.from(chave.split(".")[1], "base64url").toString()).role; } catch { return ""; } })();
if (role && role !== "anon") erro(`a chave informada é "${role}", não a pública (anon). Nunca coloque a chave de serviço no site.`);
console.log(`✔ Build de ensaio aponta para ${new URL(url).host} (não é a produção).`);
