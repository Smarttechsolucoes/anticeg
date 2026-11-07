// Depois do fechamento do banco, o cliente ANÔNIMO (supabase) não apaga em quase nenhuma tabela nem grava saldo/bloqueio: essas operações do painel precisam usar o cliente da administradora (clienteAdmin()).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const MANTEM_DELETE = new Set(["push_subscriptions", "claims", "item_fotos"]);   // as únicas em que o visitante ainda apaga (Q6b)
const ln = i => app.slice(0, i).split("\n").length;
test("o cliente anônimo só apaga em tabelas em que o visitante ainda pode apagar", () => {
  const ruins = [];
  for (const m of app.matchAll(/\bsupabase\s*\.from\((["'])([a-z_0-9]+)\1\)\s*\.delete\(/g)) if (!MANTEM_DELETE.has(m[2])) ruins.push(`${m[2]} (linha ${ln(m.index)})`);
  assert.deepEqual(ruins, [], "use clienteAdmin() para apagar nestas tabelas: " + ruins.join(", "));
});
test("saldo de cashback e bloqueio de joiner são gravados só com o cliente da administradora", () => {
  const ruins = [];
  for (const m of app.matchAll(/\bsupabase\s*\.from\((["'])joiners\1\)\s*\.update\(\s*\{([^}]*)\}/g)) if (/saldo_cashback|bloqueado/.test(m[2])) ruins.push(`linha ${ln(m.index)}`);
  assert.deepEqual(ruins, [], "estas gravações precisam de clienteAdmin(): " + ruins.join(", "));
});
test("depois da Q6c o cliente anônimo não lê com select(\"*\") as tabelas cujo endereço de comprovante é escondido (o painel usa clienteAdmin())", () => {
  const ruins = [];
  for (const m of app.matchAll(/\bsupabase\s*\.from\((["'])(pagamento_demandas|mercari_pedidos|envio_solicitacoes|repassos)\1\)\s*\.select\(\s*(["'])\*\3/g)) ruins.push(`${m[2]} (linha ${ln(m.index)})`);
  assert.deepEqual(ruins, [], "use clienteAdmin() ou COLS_*: " + ruins.join(", "));
});
