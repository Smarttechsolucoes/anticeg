// Gera o SQL ÚNICO para montar o projeto Supabase de TESTE do ensaio da etapa 1 (dados 100% fictícios).
// Monta a MESMA sequência que o laboratório testa (tests/sql/e1-cadastro-tarefas.mjs): base mínima + trechos de J1d/J6/J4c1 (referências, já em produção) + E1 + função de semeadura só do ensaio.
// NUNCA rode o arquivo gerado na produção: ele recusa se já existir public.joiners.
// Uso: node scripts/e1-gerar-sql-ensaio.mjs <saida.sql>
import { readFileSync, writeFileSync } from "node:fs";

const saida = process.argv[2];
if (!saida) { console.error("Uso: node scripts/e1-gerar-sql-ensaio.mjs <saida.sql>"); process.exit(2); }
const R = new URL("../supabase/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arq = f => readFileSync(R + f, "utf8").replace(/\r/g, "");
const fatia = (txt, inicio, fim = "\nend $$;") => { const i = txt.indexOf(inicio); if (i < 0) throw new Error("não achei: " + inicio); return txt.slice(i, txt.indexOf(fim, i) + fim.length); };
const j6 = arq("joiners-auth/J6_perfil_obrigatorio_aplicar.sql");

const partes = [
  `-- ENSAIO E1 — projeto Supabase de TESTE (gerado por scripts/e1-gerar-sql-ensaio.mjs). DADOS FICTÍCIOS. NUNCA RODE NA PRODUÇÃO.
-- Confira o NOME do projeto no topo do SQL Editor antes de rodar: precisa ser o de TESTE.
do $$ begin
  if to_regclass('public.joiners') is not null then
    raise exception 'RECUSADO: este banco já tem public.joiners (parece o da produção ou um ensaio já montado). Nada foi alterado.';
  end if;
end $$;`,
  `-- 1) base mínima (o que J1d, J4c1, J6 e E1 esperam encontrar; na produção isso já existe)
create schema if not exists emergencia;
create function emergencia.h(t text) returns text language sql immutable set search_path = '' as $$ select encode(sha256(convert_to(lower(btrim(coalesce(t, ''))), 'UTF8')), 'hex') $$;
create function emergencia.h_arroba(t text) returns text language sql immutable set search_path = '' as $$ select emergencia.h(ltrim(btrim(coalesce(t, '')), '@')) $$;
create table emergencia.emails_confiaveis (joiner_id bigint primary key, email_hash text not null, arroba_hash text not null, registrado_em timestamptz not null default now(), origem text not null);
create table public.admins_ensaio (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.admins_ensaio a where a.user_id = auth.uid()) $$;
create table public.joiners (id bigint generated always as identity primary key, cog text unique, nome text, nome_site text, whatsapp text, email text, twitter text, recrutador text, saldo_cashback numeric default 0, confirmado boolean default true);
create table public.contas_joiner (user_id uuid primary key, joiner_id bigint not null unique references public.joiners(id), vinculado_em timestamptz default now(), origem text default 'email_verificado', perfil_concluido_em timestamptz);
grant select, insert, update, delete on all tables in schema public to service_role;`,
  `-- 2) J1d / J6 / J4c1 (REFERÊNCIAS: o mesmo texto que está em produção; aqui só para montar o ensaio)
${fatia(arq("joiners-auth/J1d_email_confiavel_aplicar.sql"), "create function emergencia.joiners_antes_trocar_identidade()")}
create trigger joiners_antes_trocar_identidade before update of email, twitter on public.joiners for each row execute function emergencia.joiners_antes_trocar_identidade();`,
  j6.slice(j6.indexOf("-- 3) sinal local"), j6.indexOf("-- 9b)")),
  `${fatia(arq("joiners-auth/J4c1_joiners_aplicar.sql"), "create function public.trg_joiners_protege_colunas()")}
revoke all on function public.trg_joiners_protege_colunas() from public, anon, authenticated;
create trigger trg_joiners_protege_colunas before update on public.joiners for each row execute function public.trg_joiners_protege_colunas();
grant select, insert, update on public.joiners to authenticated; grant select on public.contas_joiner to authenticated; grant all on all sequences in schema public to anon, authenticated, service_role;`,
  `-- 3) E1 (o que a etapa 1 entrega)
${arq("cadastro-tarefas/E1_cadastro_tarefas_aplicar.sql")}`,
  `-- 4) SÓ DO ENSAIO: semeia o cadastro fictício e o vincula à conta fictícia criada pelo script de ensaio (só a chave de serviço pode chamar)
create function public.e1_ensaio_semear(p_user uuid, p_cog text) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_email text := 'ensaio.e1@exemplo.com';
begin
  if p_cog is null or p_cog !~ '^teste_e1' then raise exception 'cadastro de ensaio precisa começar com teste_e1'; end if;
  select id into v_id from public.joiners where cog = p_cog;
  if v_id is null then insert into public.joiners (cog, nome, nome_site, email, twitter) values (p_cog, 'Teste E1 Antigo', 'T', v_email, '@' || p_cog) returning id into v_id; end if;
  insert into emergencia.emails_confiaveis values (v_id, emergencia.h(v_email), emergencia.h_arroba('@' || p_cog), now(), 'ensaio') on conflict (joiner_id) do nothing;
  delete from public.contas_joiner where joiner_id = v_id or user_id = p_user;
  insert into public.contas_joiner (user_id, joiner_id, perfil_concluido_em) values (p_user, v_id, now());
  return v_id;
end $$;
revoke all on function public.e1_ensaio_semear(uuid, text) from public, anon, authenticated;
grant execute on function public.e1_ensaio_semear(uuid, text) to service_role;
grant select on public.cadastro_tarefas to service_role;   -- o script de ensaio lê o estado das tarefas pela chave de serviço (em produção a função usa só as RPC)
select 'ENSAIO E1 pronto (dados fictícios). Próximo passo: publicar a função perfil-sync.' as resultado;`,
];
writeFileSync(saida, partes.join("\n\n") + "\n");
console.log("Gerado:", saida);
