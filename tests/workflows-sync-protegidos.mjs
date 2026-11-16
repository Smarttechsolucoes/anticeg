// Guarda: o workflow AUTOMÁTICO (sync-masterlist.yml, com cron) e o MANUAL (sync-controlado.yml) têm que ter as MESMAS proteções fixas no arquivo.
// Motivo: em 16/11/2026 o sync rodou sem elas e desmarcou pagamentos / voltou status de itens já enviados. Uso: node tests/workflows-sync-protegidos.mjs
import { readFileSync } from "node:fs";
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALHA ") + m); if (!c) falhas++; };
const ler = nome => readFileSync(new URL(`../.github/workflows/${nome}`, import.meta.url), "utf8").replace(/\r/g, "");
const sem = t => t.split("\n").filter(l => !/^\s*#/.test(l)).join("\n");   // ignora linhas só de comentário
const auto = sem(ler("sync-masterlist.yml")), manual = sem(ler("sync-controlado.yml"));
const exigidas = [["SYNC_SEM_EXCLUSAO", "'1'"], ["SYNC_PROTEGER", "'1'"], ["SYNC_REGISTRO", "'1'"], ["SYNC_ENVIAR_PUSH", "''"]];
for (const [nome, txt] of [["automático (sync-masterlist.yml)", auto], ["manual (sync-controlado.yml)", manual]]) {
  for (const [k, v] of exigidas) ok(new RegExp(`^\\s*${k}:\\s*${v.replace(/'/g, "'")}`, "m").test(txt), `${nome}: ${k} fixo em ${v}`);
}
ok(/^\s*SYNC_JOINERS:\s*'somente-novos'/m.test(auto), "automático: SYNC_JOINERS fixo em 'somente-novos' (não altera cadastro existente)");
ok(/^\s*SYNC_JOINERS:\s*\$\{\{\s*inputs\.joiners\s*\}\}/m.test(manual) && /default:\s*nenhum/.test(manual), "manual: SYNC_JOINERS vem da opção e o padrão é 'nenhum'");
ok(!/vars\.SYNC_ENVIAR_PUSH/.test(auto), "automático: o push NÃO depende de variável do repositório (fixo desligado)");
ok(/cron:/.test(auto) && !/cron:/.test(manual), "só o automático tem cron; o manual não");
ok(/SYNC_DRY_RUN:\s*\$\{\{\s*inputs\.aplicar && '0' \|\| '1'\s*\}\}/.test(manual), "manual: simulação por padrão (só grava com 'aplicar')");
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES PASSARAM"); process.exit(falhas ? 1 : 0);
