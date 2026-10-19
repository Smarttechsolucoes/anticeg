// Uso único: horário de abertura das claims — evita ano/data no passado sem aviso e corrige o preenchimento/gravação na edição.
const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "..", "src", "App.jsx");
const raw = fs.readFileSync(p, "utf8");
const CR = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");
function rep(a, b, vezes = 1) {
  const n = s.split(a).length - 1;
  if (n !== vezes) throw new Error(n + " :: " + a.slice(0, 90));
  s = s.split(a).join(b);
}

// pergunta antes de gravar uma abertura que já passou (ex.: ano digitado errado)
rep(`  async function salvarEdicaoEvento() {
    if (!editEvento) return;
    setEditSalvando(true);
    const updates = { nome: editEvento.nome, valor: Number(editEvento.valor), prazo: editEvento.prazo };
    if (editEvento.abertura) updates.abertura = new Date(editEvento.abertura).toISOString();`, `  // datetime-local vem sem fuso: o horário digitado é o de Brasília (UTC-3)
  const aberturaPassada = (v) => { const d = new Date(v + ":00-03:00"); return d < new Date(Date.now() - 3600000) ? d : null; };
  const avisoPassado = (d) => "O horário de abertura (" + d.toLocaleString("pt-BR", { timeZone:"America/Sao_Paulo", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) + ") já passou, então a claim abre NA HORA. Confira o ano e o horário. Salvar assim mesmo?";

  async function salvarEdicaoEvento() {
    if (!editEvento) return;
    const passada = editEvento.abertura ? aberturaPassada(editEvento.abertura) : null;
    if (passada && !window.confirm(avisoPassado(passada))) return;
    setEditSalvando(true);
    const updates = { nome: editEvento.nome, valor: Number(editEvento.valor), prazo: editEvento.prazo };
    if (editEvento.abertura) updates.abertura = new Date(editEvento.abertura + ":00-03:00").toISOString();`);
rep(`    setSalvando(true);
    const { data: ev, error } = await supabase.from("claim_eventos").insert([{`, `    const passadaNovo = aberturaPassada(form.abertura);
    if (passadaNovo && !window.confirm(avisoPassado(passadaNovo))) return;
    setSalvando(true);
    const { data: ev, error } = await supabase.from("claim_eventos").insert([{`);

// preenchimento da edição: mostra o horário de Brasília (antes mostrava UTC, 3h a mais)
rep(`new Date(ev.abertura).toISOString().slice(0,16)`, `new Date(new Date(ev.abertura).getTime() - 3 * 3600000).toISOString().slice(0,16)`, 2);

fs.writeFileSync(p, CR ? s.replace(/\n/g, "\r\n") : s);
console.log("ok");
