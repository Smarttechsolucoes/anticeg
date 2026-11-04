// O sync só manda UPDATE para a linha que mudou, e a leitura vazia do banco aborta sem gravar nada (03/11: leitura vazia -> 7.532 cópias).
// Executa scripts/sync-masterlist.js REAL num diretório temporário, com @supabase/supabase-js, csv-parse e ws substituídos por simuladores.
// Nada de rede, nada de banco real. Rodar: node --test tests/sync-so-o-que-mudou.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function prepararDiretorio() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sync-mudou-"));
  fs.writeFileSync(path.join(d, "package.json"), '{"type":"module"}');
  for (const f of ["sync-masterlist.js", "preservar-email.js", "casar-itens.js", "resolver-joiner.js"]) fs.copyFileSync(path.join(raiz, "scripts", f), path.join(d, f));
  const mod = (nome, arquivos) => { const p = path.join(d, "node_modules", ...nome.split("/")); fs.mkdirSync(p, { recursive: true }); for (const [f, c] of Object.entries(arquivos)) fs.writeFileSync(path.join(p, f), c); };
  mod("ws", { "package.json": '{"name":"ws","type":"module","main":"index.js"}', "index.js": "export default {};" });
  mod("csv-parse", { "package.json": '{"name":"csv-parse","type":"module","exports":{"./sync":"./sync.js"}}',
    "sync.js": `export function parse(t){const L=t.split("\\n").filter(Boolean);const H=L[0].split(",");return L.slice(1).map(l=>{const c=l.split(",");const o={};H.forEach((h,i)=>o[h]=c[i]??"");return o;});}` });
  mod("@supabase/supabase-js", { "package.json": '{"name":"@supabase/supabase-js","type":"module","main":"index.js"}', "index.js": `
const modo = process.env.MODO_TESTE;
// linha 1 igual à planilha; linha 2 com valor diferente (15 no banco, 20 na planilha); a linha 3 da planilha não existe no banco
const linha = (id, idLinha, nome, item, valor) => ({ id, ceg: "CEG A", cog: nome.toLowerCase(), nome, nome_do_item: item, id_linha: idLinha, valor_item: valor, frete_inter: 0, taxa_rf: 0, info_adicionais: null,
  pago_item: false, pago_frete: false, pago_rf: false, venc_item: null, venc_frete: null, venc_rf: null, status: "Comprado" });
// no modo "ausente" o banco tem uma linha (id 9) que não está na planilha
const noBanco = modo === "leitura_vazia" ? [] : [linha(1, "A-1", "ANA", "ITEM 1", 10), linha(2, "A-2", "CLO", "ITEM 2", 15), ...(modo === "ausente" ? [linha(9, "Z-9", "BIA", "SUMIU", 5)] : [])];
// no modo "moveu_ceg" a linha 1 está no banco com outro CEG (a planilha a moveu para "CEG A"): deve continuar a MESMA linha
if (modo === "moveu_ceg") noBanco[0].ceg = "CEG ANTIGO";
class Q { constructor(t){this.t=t;this.op="select";}
  select(c,o){ if(o&&o.head)this.head=true; return this; } order(){return this;} range(a){this.pagina=a;return this;} eq(c,v){this.alvo=v;return this;} in(){return this;} limit(){return this;}
  update(p){this.op="update";this.payload=p;return this;} insert(){this.op="insert";return this;} upsert(){this.op="upsert";return this;}
  then(ok,no){ return Promise.resolve(this.resolver()).then(ok,no); }
  resolver(){
    if(this.t==="joiners"&&this.op==="select")return{data:[]};
    if(this.t==="masterlist"&&this.op==="select"){ if(this.head)return{count: modo==="leitura_vazia"?7630:noBanco.length}; if(this.pagina>0)return{data:[]}; return{data:noBanco}; }
    if(this.t==="masterlist"&&this.op==="update"){ console.log("[fake] update id="+this.alvo+" ceg="+(this.payload&&this.payload.ceg)); return{error:null}; }
    if(this.t==="masterlist"&&this.op==="insert"){ console.log("[fake] insert"); return{error:null}; }
    if(this.t==="joiners"&&this.op==="upsert")return{error:null};
    return{data:[]};
  } }
export function createClient(){ return { from:t=>new Q(t), rpc:async()=>({data:{apagadas:0,protegidas:0,por_motivo:{}},error:null}) }; }
` });
  fs.writeFileSync(path.join(d, "preload.mjs"), `
const csv = ["", "", "NUM,ID,ABA / CEG,NOME,@,NOME DO ITEM,PREÇO ITEM,ITEM",
  "1,A-1,CEG A,ANA,@ana,ITEM 1,10,FALSE", "2,A-2,CEG A,CLO,@clo,ITEM 2,20,FALSE", "3,A-3,CEG A,DEE,@dee,ITEM 3,30,FALSE"].join("\\n");
globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => csv });
`);
  return d;
}

function rodar(modo, extraEnv = {}) {
  const d = prepararDiretorio();
  const r = spawnSync(process.execPath, ["--import", "./preload.mjs", "sync-masterlist.js"], { cwd: d, encoding: "utf8", env: { ...process.env, MODO_TESTE: modo, SUPABASE_URL: "http://local.invalido", SUPABASE_SERVICE_KEY: "x", ...extraEnv } });
  fs.rmSync(d, { recursive: true, force: true });
  return { codigo: r.status, saida: r.stdout + r.stderr };
}

test("linha igual à planilha NÃO recebe UPDATE; linha que mudou recebe; linha nova é inserida", () => {
  const r = rodar("normal");
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /\[fake\] update id=2/, "a linha com valor diferente é atualizada");
  assert.doesNotMatch(r.saida, /\[fake\] update id=1\b/, "a linha igual não é atualizada");
  assert.equal((r.saida.match(/\[fake\] update/g) || []).length, 1, r.saida);
  assert.equal((r.saida.match(/\[fake\] insert/g) || []).length, 1, r.saida);
  assert.match(r.saida, /Sem mudança \(nenhum UPDATE enviado\): 1/);
  assert.match(r.saida, /1 atualizados · 1 inseridos · 0 erros/);
});

test("SYNC_ATUALIZAR_TUDO=1 volta ao comportamento antigo: atualiza todas as linhas existentes", () => {
  const r = rodar("normal", { SYNC_ATUALIZAR_TUDO: "1" });
  assert.equal(r.codigo, 0, r.saida);
  assert.equal((r.saida.match(/\[fake\] update/g) || []).length, 2, r.saida);
  assert.match(r.saida, /Sem mudança \(nenhum UPDATE enviado\): 0/);
});

test("linhas do banco que não estão na planilha são LISTADAS no log (id, código, CEG, item), sem dono nem e-mail", () => {
  const r = rodar("ausente");
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /1 registro\(s\) ausentes da planilha/);
  assert.match(r.saida, /Candidatas à remoção \(id \| código \| CEG \| item \| status \| pago item\/frete\/rf\):/);
  assert.match(r.saida, /9 \| Z-9 \| CEG A \| SUMIU \| Comprado \| n\/n\/n/);
  assert.doesNotMatch(r.saida, /bia/i, "o dono (cog/nome) da linha não aparece na lista");
});

test("CEG movido na planilha: a linha do banco é ATUALIZADA (CEG novo, mesmo id), não duplicada nem deixada para trás", () => {
  const r = rodar("moveu_ceg");
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /\[fake\] update id=1 ceg=CEG A/, "a linha 1 recebe o CEG novo");
  assert.equal((r.saida.match(/\[fake\] insert/g) || []).length, 1, "só a linha 3 (de fato nova) é inserida; a linha 1 não vira linha nova");
  assert.doesNotMatch(r.saida, /ausentes da planilha/, "a linha velha não fica para trás como candidata à remoção");
});

test("leitura vazia do banco (contagem diz 7630, páginas vazias) ABORTA sem gravar nada", () => {
  const r = rodar("leitura_vazia");
  assert.notEqual(r.codigo, 0, r.saida);
  assert.match(r.saida, /Leitura incompleta: li 0 linhas, mas o banco tem 7630/);
  assert.doesNotMatch(r.saida, /\[fake\] (insert|update)/, "nada pode ser gravado");
});
