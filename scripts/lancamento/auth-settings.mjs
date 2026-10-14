// Confere, SEM alterar nada, o que a API pública do Supabase Auth informa sobre a configuração do projeto (GET /auth/v1/settings, só com a chave pública).
// Uso (PowerShell):  $env:LANC_URL="https://SEUREF.supabase.co"; $env:LANC_ANON="<chave anon pública>"; node scripts/lancamento/auth-settings.mjs
// Recusa rodar com chave de serviço. Só LÊ. O restante da configuração (SMTP, modelos, tempo do código, limites) só aparece no painel: veja o roteiro (supabase/lancamento/LANCAMENTO.md, seção "Auth").
const URL_ = (process.env.LANC_URL || "").replace(/\/$/, ""), CHAVE = process.env.LANC_ANON || "";
const papel = (() => { try { return JSON.parse(Buffer.from(CHAVE.split(".")[1], "base64url").toString()).role; } catch { return ""; } })();
if (!URL_ || !CHAVE) { console.error("Defina LANC_URL e LANC_ANON (chave PÚBLICA)."); process.exit(2); }
if (papel !== "anon") { console.error(`A chave informada é "${papel || "desconhecida"}". Use somente a chave pública (anon). Nunca a de serviço.`); process.exit(2); }

let falhas = 0, avisos = 0;
const ok = (c, m) => { console.log((c ? "OK     " : "FALHA  ") + m); if (!c) falhas++; };
const aviso = (c, m) => { if (c) console.log("OK     " + m); else { console.log("AVISO  " + m); avisos++; } };

const r = await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: CHAVE } });
if (!r.ok) { console.error("Não consegui ler as configurações públicas do Auth (HTTP " + r.status + ")."); process.exit(2); }
const s = await r.json();
const ext = s.external || {};

console.log("Projeto:", new URL(URL_).host, "\n");
ok(ext.email === true, "provedor de e-mail ligado (necessário: código de ativação e senha)");
ok(s.mailer_autoconfirm !== true, "confirmação de e-mail LIGADA (mailer_autoconfirm desligado): a conta só vale depois de provar o e-mail");
// O pedido de código passa pela função pedir-codigo-joiner (servidor): ela cria a conta só para joiner real e liberada. Por isso o cadastro público NÃO é necessário e o melhor é deixá-lo DESLIGADO.
if (s.disable_signup === true) ok(true, "cadastro público de usuários DESLIGADO (correto: a conta é criada só pela função pedir-codigo-joiner, para joiner real e liberada, com limite de tentativas)");
else aviso(false, "cadastro público de usuários está LIGADO. Não é necessário: qualquer pessoa conseguiria criar conta de e-mail e disparar e-mails. A conta sem vínculo não vê nada (testado), mas prefira DESLIGAR em Authentication → Sign In / Providers → Email");
for (const p of Object.keys(ext).filter(k => k !== "email" && ext[k] === true)) aviso(false, `provedor externo "${p}" está LIGADO e o site não usa: desligue se não for necessário`);
aviso(s.phone_autoconfirm !== true && ext.phone !== true, "login por telefone desligado");
aviso(s.sms_provider == null || s.sms_provider === "", "nenhum provedor de SMS configurado");

console.log(`\n${falhas ? falhas + " FALHA(S)" : "Configuração pública conforme o esperado"}${avisos ? " · " + avisos + " aviso(s)" : ""}.`);
console.log("Lembrete: conta criada NÃO é acesso concedido: ela só enxerga dados depois de confirmar o e-mail e ser vinculada a uma joiner (e-mail igual ao cadastro, ativação liberada) ou se for administradora.");
process.exit(falhas ? 1 : 0);
