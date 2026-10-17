// Teste de FUMAÇA das 3 funções do piloto, DEPOIS de publicadas (Etapa 4). Usa só a chave PÚBLICA e um @ que não existe: não envia e-mail, não cria conta, não toca em nenhum cadastro.
// (Cada chamada deixa 1 linha de tentativa em tentativas_acesso para o @ de teste: é o controle de limite, inofensivo.)
// Uso (PowerShell, na pasta do repositório):  $env:LANC_URL="https://ghjfsmwwcfpfvrouyrka.supabase.co"; $env:LANC_ANON="<chave anon pública>"; node supabase/piloto-senhas/testar-funcoes.mjs
// Sem as variáveis, usa as constantes públicas de src/supabase.js. Recusa chave de serviço.
import { readFileSync } from "node:fs";
let URL_ = (process.env.LANC_URL || "").replace(/\/$/, ""), CHAVE = process.env.LANC_ANON || "";
if (!URL_ || !CHAVE) {
  try {
    const f = readFileSync(new URL("../../src/supabase.js", import.meta.url), "utf8");
    URL_ = URL_ || (f.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [""])[0]; CHAVE = CHAVE || (f.match(/eyJ[A-Za-z0-9_.-]+/) || [""])[0];
  } catch { /* sem o arquivo */ }
}
const papel = (() => { try { return JSON.parse(Buffer.from(CHAVE.split(".")[1], "base64url").toString()).role; } catch { return ""; } })();
if (!URL_ || papel !== "anon") { console.error(`Preciso da URL do projeto e da chave PÚBLICA (anon). Papel da chave: "${papel || "desconhecido"}".`); process.exit(2); }

const ORIGEM = "https://anticeg.vercel.app", FALSO = "naoexiste_piloto_xyz";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK     " : "FALHA  ") + m); if (!c) falhas++; };
const chamar = async (fn, corpo, origem = ORIGEM) => {
  const r = await fetch(`${URL_}/functions/v1/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, Origin: origem }, body: JSON.stringify(corpo) });
  const texto = await r.text(); let json = null; try { json = JSON.parse(texto); } catch { /* sem JSON */ }
  return { status: r.status, json, texto, acao: r.headers.get("access-control-allow-origin") };
};
const semEmail = t => !/[^\s"@]+@[^\s"@]+\.[a-z]{2,}/i.test(t);

console.log("Projeto:", new URL(URL_).host, "\n── funções publicadas e CORS ──");
for (const fn of ["pedir-codigo-joiner", "login-joiner", "recuperar-senha-joiner"]) {
  const o = await fetch(`${URL_}/functions/v1/${fn}`, { method: "OPTIONS", headers: { Origin: ORIGEM, apikey: CHAVE, "Access-Control-Request-Method": "POST" } });
  ok(o.status === 200 && o.headers.get("access-control-allow-origin") === ORIGEM, `${fn}: publicada e responde ao site (HTTP ${o.status}, origem permitida: ${o.headers.get("access-control-allow-origin")})`);
  const x = await fetch(`${URL_}/functions/v1/${fn}`, { method: "OPTIONS", headers: { Origin: "https://golpe.example", apikey: CHAVE, "Access-Control-Request-Method": "POST" } });
  ok(x.headers.get("access-control-allow-origin") === null, `${fn}: NÃO libera outra origem`);
}
console.log("── respostas neutras (um @ que não existe) ──");
const p = await chamar("pedir-codigo-joiner", { cog: FALSO, email: "naoexiste@invalido.test" });
ok(p.status === 200 && JSON.stringify(p.json) === '{"ok":true}', `pedir-codigo-joiner: HTTP 200 {"ok":true} (igual a qualquer caso; não revela nada): ${p.texto.slice(0, 80)}`);
const pe = await chamar("pedir-codigo-joiner", { cog: FALSO, email: "naoexiste@invalido.test", liberada: true });
ok(pe.status === 400, `pedir-codigo-joiner: campo extra (o cliente tentando escolher a lista) é recusado (HTTP ${pe.status})`);
const l = await chamar("login-joiner", { cog: FALSO, senha: "senha-qualquer" });
ok(l.status === 401 && /@ ou senha incorretos/.test(l.texto) && semEmail(l.texto), `login-joiner: HTTP 401 "@ ou senha incorretos." sem e-mail na resposta (HTTP ${l.status})`);
const r = await chamar("recuperar-senha-joiner", { cog: FALSO });
ok(r.status === 200 && r.json && r.json.ok === true && semEmail(r.texto), `recuperar-senha-joiner: HTTP 200 genérico, sem e-mail na resposta (HTTP ${r.status})`);
console.log("── Auth (leitura pública) ──");
const s = await (await fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: CHAVE } })).json();
ok(s.disable_signup === true, "cadastro público DESLIGADO" + (s.disable_signup === true ? "" : " (ainda ligado: painel → Sign In / Providers → User Signups)"));
ok(s.mailer_autoconfirm !== true, "confirmação de e-mail LIGADA");
console.log(falhas ? `\n${falhas} FALHA(S): NÃO convide ninguém ainda.` : "\nTUDO CERTO: as funções estão no ar, neutras e fechadas. Pode seguir para o teste com as pessoas.");
process.exitCode = falhas ? 1 : 0;
