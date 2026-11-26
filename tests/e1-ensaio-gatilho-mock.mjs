// Ensaio do SCRIPT do ensaio do gatilho (scripts/e1-ensaio-gatilho.mjs) contra um servidor local que imita Auth + REST do Supabase e o Apps Script de teste.
// Prova a lógica do script (recusas, espera, linha do tempo, conferências, limpeza, falha por tempo esgotado). NÃO prova o Supabase nem o gatilho reais: isso é o ensaio de verdade.
// Uso: node tests/e1-ensaio-gatilho-mock.mjs
import http from "node:http";
import { spawn } from "node:child_process";

let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SERV = "chave-de-servico-de-teste-aaaaaaaaaaaa", ANON = "chave-anon-de-teste-bbbbbbbbbbbb", TOKEN = "token-da-planilha-de-teste-cccccccccc";
let estado, apagou;
const reiniciar = (viravel = true) => { estado = { t0: null, nome: null, viravel }; apagou = false; };
const base = { constantes: "c-0", formulas: "f-0" };
const linhasMaster = nome => [{ linha: 4, nome, formula_nome: "=VLOOKUP(F4,Dados!A:B,2,0)" }, { linha: 5, nome, formula_nome: "=VLOOKUP(F5,Dados!A:B,2,0)" }, { linha: 6, nome: "Nome Fixo Digitado", formula_nome: "" }];
const sincronizada = () => estado.t0 && estado.viravel && Date.now() - estado.t0 > 2200;

const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", c => (b += c)); req.on("end", () => {
    const j = o => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    const corpo = b ? JSON.parse(b) : {};
    if (req.url === "/exec") {
      if (corpo.token !== TOKEN) return j({ erro: "token" });
      if (corpo.acao === "e1_identificar") return j({ ok: true, teste: true, nome: "TESTE E1 - fictícia - NÃO USAR", abas: ["Dados", "MASTERLIST"], id_final: "ab12" });
      const nome = sincronizada() ? estado.nome : "Teste E1 Antigo";
      return j({ ok: true, dados: [{ linha: 2, nome, email: "", id_site: sincronizada() ? 7 : "", papel: sincronizada() ? "principal" : "", versao: sincronizada() ? 3 : "" }], master: linhasMaster(nome), digesto_constantes: base.constantes, digesto_formulas: base.formulas });
    }
    if (req.url.startsWith("/auth/v1/admin/users") && req.method === "POST") return j({ id: "00000000-0000-0000-0000-00000000aaaa" });
    if (req.url.startsWith("/auth/v1/admin/users") && req.method === "DELETE") { apagou = true; return j({}); }
    if (req.url.startsWith("/auth/v1/token")) return j({ access_token: "jwt-de-teste" });
    if (req.url.endsWith("/rpc/e1_ensaio_semear")) return j(7);
    if (req.url.endsWith("/rpc/salvar_meu_cadastro")) { estado.t0 = Date.now(); estado.nome = corpo.p_nome; return j({ ok: true, nome: corpo.p_nome }); }
    if (req.url.startsWith("/rest/v1/cadastro_tarefas")) return j([{ id: 1, planilha_status: sincronizada() ? "sincronizada" : "pendente", planilha_tentativas: 0, planilha_motivo: null, lida_em: null }]);
    res.writeHead(404); res.end("{}");
  });
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const porta = srv.address().port, U = `http://127.0.0.1:${porta}`;
const rodar = env => new Promise(res => { const p = spawn(process.execPath, ["scripts/e1-ensaio-gatilho.mjs"], { env: { ...process.env, E1_POLL_SEG: "1", ...env }, cwd: raiz }); let o = ""; p.stdout.on("data", c => (o += c)); p.stderr.on("data", c => (o += c)); p.on("close", code => res({ code, o })); });
const bom = { E1_CONFIRMO_ENSAIO: "1", E1_SUPABASE_URL: U, E1_SUPABASE_ANON_KEY: ANON, E1_SUPABASE_SERVICE_KEY: SERV, E1_PLANILHA_URL: U + "/exec", E1_PLANILHA_TOKEN: TOKEN, PLANILHA_URL: "" };

reiniciar();
const a = await rodar({ ...bom, E1_CONFIRMO_ENSAIO: "" }); ok(a.code === 2 && /E1_CONFIRMO_ENSAIO=1/.test(a.o) && estado.t0 === null, "sem confirmação o script RECUSA");
const b = await rodar({ ...bom, E1_SUPABASE_URL: "https://ghjfsmwwcfpfvrouyrka.supabase.co" }); ok(b.code === 2 && /PRODUÇÃO/.test(b.o) && estado.t0 === null, "com a URL do Supabase de produção o script RECUSA");
const c = await rodar({ ...bom, PLANILHA_URL: U + "/exec" }); ok(c.code === 2 && /PLANILHA_URL de produção/.test(c.o), "com a URL da planilha igual à de produção o script RECUSA");
const d = await rodar({ ...bom, E1_PLANILHA_TOKEN: "errado" }); ok(d.code === 2 && /NÃO é a planilha de teste/.test(d.o) && estado.t0 === null, "planilha que não se identifica como de teste: RECUSA antes de criar conta ou gravar");

reiniciar(); const bomRun = await rodar({ ...bom, E1_ESPERA_MIN: "1" });
console.log(bomRun.o.split("\n").map(l => "   | " + l).join("\n"));
ok(bomRun.code === 0 && /ENSAIO CONCLUÍDO/.test(bomRun.o), "com tudo certo o script passa");
ok(/\+0s pendente/.test(bomRun.o) && /\+\d+s sincronizada/.test(bomRun.o), "mostra a linha do tempo pendente → sincronizada");
ok(apagou, "a conta fictícia é removida no fim");
ok(![SERV, ANON, TOKEN, "jwt-de-teste", "127.0.0.1"].some(s => bomRun.o.includes(s)), "o script não imprime chaves, token, JWT nem URLs");

reiniciar(false); const lento = await rodar({ ...bom, E1_ESPERA_MIN: "0.04" });
ok(lento.code === 1 && /FALHA a tarefa saiu de 'pendente'/.test(lento.o) && apagou, "se o gatilho não disparar dentro do prazo, o script FALHA, explica e ainda remove a conta fictícia");
srv.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
