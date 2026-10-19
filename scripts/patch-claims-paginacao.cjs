// Uso único: as telas de claims buscavam no máximo 1000 reservas (limite do banco) e cortavam as mais novas.
// Passa a buscar em páginas de 1000 até acabar.
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b, minimo = 1, maximo = 1) {
  const n = s.split(a).length - 1;
  if (n < minimo || n > maximo) throw new Error(n + " :: " + a.slice(0, 90));
  s = s.split(a).join(b);
}

rep(`function ClaimHistorico() {`, `// O banco devolve no máximo 1000 linhas por consulta: busca em páginas até acabar (sem isso as mais novas somem).
async function buscarPaginado(montar) {
  const todas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error || !data) break;
    todas.push(...data);
    if (data.length < 1000) break;
  }
  return todas;
}

function ClaimHistorico() {`);

// admin (todas as claims) — sets, reservas e standby
rep(`const { data: setsData } = await supabase.from("claim_sets").select("*").in("evento_id", evIds).order("numero");`,
    `const setsData = await buscarPaginado(() => supabase.from("claim_sets").select("*").in("evento_id", evIds).order("numero").order("id"));`);
rep(`const { data: resData } = await supabase.from("claim_reservas").select("*").in("set_id", setIds).neq("status","cancelado").order("created_at");`,
    `const resData = await buscarPaginado(() => supabase.from("claim_reservas").select("*").in("set_id", setIds).neq("status","cancelado").order("created_at").order("id"));`, 2, 2);
rep(`const { data: sbData } = await supabase.from("claim_reservas").select("*").in("evento_id", evIds).is("set_id", null).neq("status","cancelado").order("created_at");`,
    `const sbData = await buscarPaginado(() => supabase.from("claim_reservas").select("*").in("evento_id", evIds).is("set_id", null).neq("status","cancelado").order("created_at").order("id"));`, 2, 2);

// histórico (eventos encerrados)
rep(`      const { data: setsData } = await supabase.from("claim_sets")
        .select("*").in("evento_id", evIds).neq("status","cancelado").order("numero");`,
    `      const setsData = await buscarPaginado(() => supabase.from("claim_sets")
        .select("*").in("evento_id", evIds).neq("status","cancelado").order("numero").order("id"));`);
rep(`      const { data: resData } = await supabase.from("claim_reservas")
        .select("*").in("set_id", setIds).neq("status","cancelado").order("created_at");`,
    `      const resData = await buscarPaginado(() => supabase.from("claim_reservas")
        .select("*").in("set_id", setIds).neq("status","cancelado").order("created_at").order("id"));`, 1, 2);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
