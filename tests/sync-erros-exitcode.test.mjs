// O sync deve terminar com falha (código 4) quando há erro por linha, sem mudar o resto do comportamento.
// Executa scripts/sync-masterlist.js REAL num diretório temporário, com @supabase/supabase-js, csv-parse e ws substituídos por simuladores
// e o fetch do CSV servido de dentro do teste. Nada de rede, nada de banco real.
// Rodar: node --test tests/sync-erros-exitcode.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function prepararDiretorio() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sync-erros-"));
  fs.writeFileSync(path.join(d, "package.json"), '{"type":"module"}');
  for (const f of ["sync-masterlist.js", "preservar-email.js", "casar-itens.js"]) fs.copyFileSync(path.join(raiz, "scripts", f), path.join(d, f));
  const mod = (nome, arquivos) => { const p = path.join(d, "node_modules", ...nome.split("/")); fs.mkdirSync(p, { recursive: true }); for (const [f, c] of Object.entries(arquivos)) fs.writeFileSync(path.join(p, f), c); };
  mod("ws", { "package.json": '{"name":"ws","type":"module","main":"index.js"}', "index.js": "export default {};" });
  mod("csv-parse", { "package.json": '{"name":"csv-parse","type":"module","exports":{"./sync":"./sync.js"}}',
    "sync.js": `export function parse(t){const L=t.split("\\n").filter(Boolean);const H=L[0].split(",");return L.slice(1).map(l=>{const c=l.split(",");const o={};H.forEach((h,i)=>o[h]=c[i]??"");return o;});}` });
  mod("@supabase/supabase-js", { "package.json": '{"name":"@supabase/supabase-js","type":"module","main":"index.js"}', "index.js": `
const modo = process.env.MODO_TESTE;
class Q { constructor(t){this.t=t;this.op="select";}
  select(){return this;} order(){return this;} range(a){this.pagina=a;return this;} eq(){return this;} in(){return this;} limit(){return this;}
  update(){this.op="update";return this;} insert(){this.op="insert";return this;} upsert(){this.op="upsert";return this;}
  then(ok,no){ return Promise.resolve(this.resolver()).then(ok,no); }
  resolver(){
    if(this.t==="joiners"&&this.op==="select")return{data:[]};
    if(this.t==="masterlist"&&this.op==="select"){ if(this.pagina>0)return{data:[]};
      const ex=[{id:1,ceg:"CEG A",nome_do_item:"ITEM 1",nome:"ANA",status:"Comprado",pago_item:false,pago_frete:false,pago_rf:false}];
      if(modo==="prune_aborta"||modo==="erro_linha_e_prune")ex.push({id:9,ceg:"CEG Z",nome_do_item:"SUMIU",nome:"BIA",status:"Comprado",pago_item:false,pago_frete:false,pago_rf:false});
      return{data:ex}; }
    if(this.t==="masterlist"&&this.op==="update")return{error:(modo==="erro_linha"||modo==="erro_linha_e_prune")?{message:"falha simulada na linha"}:null};
    if(this.t==="masterlist"&&this.op==="insert")return{error:null};
    if(this.t==="joiners"&&this.op==="upsert")return{error:modo==="erro_joiner"?{message:"falha simulada no joiner"}:null};
    return{data:[]};
  } }
export function createClient(){ return { from:t=>new Q(t), rpc:async()=>({data:modo==="prune_aborta"||modo==="erro_linha_e_prune"?{abortado:true,motivo:"simulado"}:{apagadas:0,protegidas:0,por_motivo:{}},error:null}) }; }
` });
  fs.writeFileSync(path.join(d, "preload.mjs"), `
const csv = ["", "", "NUM,ID,ABA / CEG,NOME,@,NOME DO ITEM", "1,A-1,CEG A,ANA,@ana,ITEM 1", "2,A-2,CEG A,CLO,@clo,ITEM 2"].join("\\n");
globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => csv });
`);
  return d;
}

function rodar(modo) {
  const d = prepararDiretorio();
  const r = spawnSync(process.execPath, ["--import", "./preload.mjs", "sync-masterlist.js"], { cwd: d, encoding: "utf8", env: { ...process.env, MODO_TESTE: modo, SUPABASE_URL: "http://local.invalido", SUPABASE_SERVICE_KEY: "x" } });
  fs.rmSync(d, { recursive: true, force: true });
  return { codigo: r.status, saida: r.stdout + r.stderr };
}

test("sem erros: termina com sucesso (código 0)", () => {
  const r = rodar("ok");
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /1 atualizados · 1 inseridos · 0 erros/);
  assert.doesNotMatch(r.saida, /Sync com erros por linha/);
});

test("erro em linha da masterlist: job falha (4) e o log detalhado do erro continua", () => {
  const r = rodar("erro_linha");
  assert.equal(r.codigo, 4, r.saida);
  assert.match(r.saida, /Erro: falha simulada na linha/);
  assert.match(r.saida, /Sync com erros por linha: 1 na masterlist · 0 em joiners/);
  assert.match(r.saida, /✓ Joiners:/, "as demais atualizações continuam sendo feitas");
});

test("erro em joiner: job falha (4)", () => {
  const r = rodar("erro_joiner");
  assert.equal(r.codigo, 4, r.saida);
  assert.match(r.saida, /Erro joiner: falha simulada no joiner/);
});

test("exclusão protegida abortada continua com o código 3 (existente), sem ser trocado por 4", () => {
  const r = rodar("prune_aborta");
  assert.equal(r.codigo, 3, r.saida);
  const r2 = rodar("erro_linha_e_prune");
  assert.equal(r2.codigo, 3, r2.saida);
  assert.match(r2.saida, /Sync com erros por linha/, "o aviso de erro por linha também aparece");
});
