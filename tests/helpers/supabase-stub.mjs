// Substituto MÍNIMO do @supabase/supabase-js para testar o script REAL do sync (scripts/sync-masterlist.js) contra um banco local (PGlite), sem rede.
// Implementa só o que o script usa: from().select/update/insert/upsert/delete + eq/in/order/range, e rpc() com argumentos nomeados. Papel de serviço (bypassrls), como no GitHub Actions.
// O banco vem de globalThis.__SYNC_DB (definido pelo executor antes de importar o script).
const tipoLista = v => (v.length && typeof v[0] === "number" ? "bigint[]" : "text[]");
const ident = n => { if (!/^[a-z_][a-z0-9_]*$/i.test(n)) throw new Error("identificador inválido: " + n); return n; };

class Consulta {
  constructor(tabela) { this.t = ident(tabela); this.op = "select"; this.cols = "*"; this.filtros = []; this.params = []; this.ord = ""; this.lim = ""; this.dados = null; this.conflito = null; }
  select(c) { if (this.op === "select") this.cols = c; return this; }
  update(o) { this.op = "update"; this.dados = o; return this; }
  insert(a) { this.op = "insert"; this.dados = a; return this; }
  upsert(o, { onConflict } = {}) { this.op = "upsert"; this.dados = [o]; this.conflito = onConflict; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.params.push(v); this.filtros.push(`${ident(c)} = $${this.params.length}`); return this; }
  in(c, arr) { this.params.push(arr); this.filtros.push(`${ident(c)} = any($${this.params.length}::${tipoLista(arr)})`); return this; }
  order(c, { ascending = true } = {}) { this.ord = ` order by ${ident(c)} ${ascending ? "asc" : "desc"}`; return this; }
  range(a, b) { this.lim = ` limit ${b - a + 1} offset ${a}`; return this; }
  async executar() {
    const db = globalThis.__SYNC_DB; const where = this.filtros.length ? " where " + this.filtros.join(" and ") : "";
    try {
      if (this.op === "select") return { data: (await db.query(`select ${this.cols} from public.${this.t}${where}${this.ord}${this.lim}`, this.params)).rows, error: null };
      if (this.op === "update") {
        const cs = Object.keys(this.dados); const ps = [...cs.map(c => this.dados[c]), ...this.params];
        const w = this.filtros.length ? " where " + this.filtros.map(f => f.replace(/\$(\d+)/g, (_, n) => "$" + (Number(n) + cs.length))).join(" and ") : "";
        await db.query(`update public.${this.t} set ${cs.map((c, i) => `${ident(c)} = $${i + 1}`).join(", ")}${w}`, ps); return { data: null, error: null };
      }
      if (this.op === "insert" || this.op === "upsert") {
        for (const o of this.dados) {
          const cs = Object.keys(o); const vs = cs.map(c => o[c]);
          let q = `insert into public.${this.t} (${cs.map(ident).join(", ")}) values (${cs.map((_, i) => "$" + (i + 1)).join(", ")})`;
          if (this.op === "upsert") q += ` on conflict (${ident(this.conflito)}) do update set ${cs.filter(c => c !== this.conflito).map(c => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`;
          await db.query(q, vs);
        }
        return { data: null, error: null };
      }
      if (this.op === "delete") { await db.query(`delete from public.${this.t}${where}`, this.params); return { data: null, error: null }; }
    } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
  }
  then(res, rej) { return this.executar().then(res, rej); }
}

export function createClient() {
  return {
    from: t => new Consulta(t),
    async rpc(nome, args = {}) {
      const db = globalThis.__SYNC_DB; const ks = Object.keys(args); const ps = ks.map(k => args[k]);
      try {
        const r = await db.query(`select public.${ident(nome)}(${ks.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")}) as r`, ps);
        return { data: r.rows[0].r, error: null };
      } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
    },
  };
}
