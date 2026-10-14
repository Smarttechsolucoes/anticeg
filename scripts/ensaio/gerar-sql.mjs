// Gera os SQLs do projeto Supabase de ENSAIO (um arquivo por etapa, na ordem certa) a partir dos arquivos do repositório.
// Uso: node scripts/ensaio/gerar-sql.mjs        ->  supabase/ensaio/gerado/ENSAIO_1_base.sql, ENSAIO_2_lancamento.sql, ENSAIO_3_storage.sql
// Nada é executado: você cola cada arquivo no SQL Editor do projeto de ENSAIO (nunca no de produção). Os arquivos gerados não vão para o git.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const raiz = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ler = (dir, arq) => { const p = raiz + dir + "/" + arq; if (!existsSync(p)) throw new Error(`Arquivo ausente: ${dir}/${arq} (esta branch tem todos os PRs do J4?)`); return readFileSync(p, "utf8").replace(/\r\n/g, "\n"); };
const junta = (titulo, itens) => `-- ${titulo}\n-- GERADO por scripts/ensaio/gerar-sql.mjs — rode SOMENTE no projeto de ENSAIO.\n\n` +
  itens.map(([dir, arq]) => `-- ═════ ${dir}/${arq} ═════\n${ler(dir, arq)}\n`).join("\n");
const aviso = "do $$ begin if to_regclass('public.masterlist') is not null or to_regclass('public.joiners') is not null then raise exception 'Este banco JÁ TEM tabelas do site (masterlist/joiners): pode ser a PRODUÇÃO. Pare. O ensaio só roda em projeto novo e vazio.'; end if; end $$;" + "\n";

mkdirSync(raiz + "ensaio/gerado", { recursive: true });
writeFileSync(raiz + "ensaio/gerado/.gitignore", "*\n!.gitignore\n");

// Etapa 1: o estado de HOJE da produção (sem o site novo), só com dados fictícios
writeFileSync(raiz + "ensaio/gerado/ENSAIO_1_base.sql", junta("ENSAIO 1 — estado de HOJE (esquema mínimo, políticas abertas de hoje, travas C0, dados FICTÍCIOS, login admin, J1 e J3)", [
  ["laboratorio", "01_schema_minimo.sql"], ["laboratorio", "02_politicas_de_hoje_simuladas.sql"], ["laboratorio", "03_dados_ficticios.sql"], ["laboratorio", "04_tabelas_j4c.sql"], ["laboratorio", "05_travas_c0_simuladas.sql"], ["laboratorio", "06_lojas_publicas.sql"], ["laboratorio", "07_tabelas_j4c4.sql"],
  ["admin-auth", "A1_base_aplicar.sql"], ["admin-auth", "A2_senha_apenas_aplicar.sql"],
  ["joiners-auth", "J1_estrutura_aplicar.sql"], ["joiners-auth", "J3_tentativas_aplicar.sql"],
  // controle de envios de e-mail (PR das notificações): entra se o arquivo existir nesta branch
  ...(existsSync(raiz + "notificacoes/N1_emails_enviados_aplicar.sql") ? [["notificacoes", "N1_emails_enviados_aplicar.sql"]] : []),
]).replace("-- ═════ laboratorio/01", () => "-- (guarda: recusa rodar em banco que já tem as tabelas do site)\n" + aviso + "-- ═════ laboratorio/01"));

// Etapa 2: o LANÇAMENTO (a ordem é a mesma da produção)
writeFileSync(raiz + "ensaio/gerado/ENSAIO_2_lancamento.sql", junta("ENSAIO 2 — LANÇAMENTO: J4-0, J4a, J4b, J4c-1, J4c-2, J4c-3, J4c-4a/b/c/d (rode só depois de cadastrar a administradora de ensaio, passo 4 do guia)", [
  ["joiners-auth", "J4_0_admin_em_todas_aplicar.sql"], ["joiners-auth", "J4a_publico_aplicar.sql"], ["joiners-auth", "J4b_lote1_aplicar.sql"],
  ["joiners-auth", "J4c1_joiners_aplicar.sql"], ["joiners-auth", "J4c2_pedidos_claims_aplicar.sql"], ["joiners-auth", "J4c3_lojas_aplicar.sql"],
  ["joiners-auth", "J4c4a_mercari_lojinha_aplicar.sql"], ["joiners-auth", "J4c4b_claims_sets_aplicar.sql"], ["joiners-auth", "J4c4c_pessoais_aplicar.sql"], ["joiners-auth", "J4c4d_admin_catalogos_aplicar.sql"], ["joiners-auth", "J4c4e_cegs_publico_aplicar.sql"],
  // proteção do sync (PR separado): entra se o arquivo existir nesta branch
  ...(existsSync(raiz + "sync/S1_prune_protegido_aplicar.sql") ? [["sync", "S1_prune_protegido_aplicar.sql"]] : []),
]));

// Etapa 3: storage de ensaio
writeFileSync(raiz + "ensaio/gerado/ENSAIO_3_storage.sql", `-- ENSAIO 3 — buckets de ensaio (vazios). Rode SOMENTE no projeto de ENSAIO.
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', true), ('avatars', 'avatars', true), ('storage-itens', 'storage-itens', true), ('anti-store', 'anti-store', false)
on conflict (id) do nothing;
-- como na produção de hoje, o bucket comprovantes é público e quem tem o link lê; envio e listagem seguem as regras do projeto (veja o guia).
`);
console.log("Gerado em supabase/ensaio/gerado/: ENSAIO_1_base.sql, ENSAIO_2_lancamento.sql, ENSAIO_3_storage.sql");
