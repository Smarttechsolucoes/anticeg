-- E1 — REVERSÃO. Desfaz exatamente o que o E1 fez e ARQUIVA antes de apagar (nada se perde): tarefas, itens 'cadastro' da fila e pedidos 'sem prova'/'nome'.
-- Restaura as 3 funções alteradas (gatilho de proteção, gatilho do Auth, marcação da fila) a partir da cópia guardada em emergencia.c0b_estado_anterior (etapa 'E1').
-- Não mexe em cog, itens, pagamentos, claims, vínculos de conta nem em nenhum cadastro. Uma transação; se algo falhar: "Nada foi alterado.".
begin;
do $$
begin
  if to_regclass('public.cadastro_tarefas') is null then raise exception 'E1 não está aplicado. Nada foi alterado.'; end if;
  if (select count(*) from emergencia.c0b_estado_anterior where etapa = 'E1' and objeto like 'funcao %') <> 3 then raise exception 'Não encontrei a cópia das 3 funções anteriores. Nada foi alterado.'; end if;
end $$;

-- arquivo (permanece depois da reversão)
create table emergencia.cadastro_tarefas_arquivo as select * from public.cadastro_tarefas;
create table emergencia.perfil_sync_cadastro_arquivo as select * from public.perfil_sync_pendente where tipo = 'cadastro';
create table emergencia.perfil_solicitacoes_e1_arquivo as select * from public.perfil_solicitacoes where sem_prova or tipo = 'nome';
revoke all on table emergencia.cadastro_tarefas_arquivo, emergencia.perfil_sync_cadastro_arquivo, emergencia.perfil_solicitacoes_e1_arquivo from public, anon, authenticated;

-- gatilhos e funções novas
drop trigger if exists joiners_tarefa_cadastro on public.joiners;
drop trigger if exists solicitacao_vira_tarefa on public.perfil_solicitacoes;
drop trigger if exists solicitacao_encerra_tarefa on public.perfil_solicitacoes;
drop function if exists public.admin_cadastro_tarefas(integer), public.admin_cadastro_pendentes(), public.admin_cadastro_marcar_lida(bigint), public.admin_cadastro_marcar_atencao_vista(bigint),
  public.admin_cadastro_resolver(bigint, text), public.admin_cadastro_reprocessar(bigint), public.salvar_meu_cadastro(text), public.solicitar_alteracao_sem_login(text, text, text, text), public.perfil_sync_estado(bigint);
drop function if exists emergencia.joiners_tarefa_cadastro(), emergencia.solicitacao_vira_tarefa(), emergencia.solicitacao_encerra_tarefa(), emergencia.tarefa_pendente(public.cadastro_tarefas);

-- funções restauradas (texto original guardado na aplicação)
do $$
declare r record;
begin
  for r in select detalhe from emergencia.c0b_estado_anterior where etapa = 'E1' and objeto in ('funcao trg_joiners_protege_colunas', 'funcao auth_email_depois', 'funcao perfil_sync_marcar') order by id loop
    execute r.detalhe;
  end loop;
end $$;
drop function if exists public.perfil_sync_marcar(bigint, boolean, text, boolean);

-- fila e pedidos voltam ao formato do J6
delete from public.perfil_sync_pendente where tipo = 'cadastro';
alter table public.perfil_sync_pendente drop constraint if exists perfil_sync_pendente_tipo_check;
alter table public.perfil_sync_pendente add constraint perfil_sync_pendente_tipo_check check (tipo in ('email'));
alter table public.perfil_sync_pendente drop column if exists tarefa_id;
delete from public.perfil_solicitacoes where tipo = 'nome';
alter table public.perfil_solicitacoes drop constraint if exists perfil_solicitacoes_tipo_check;
alter table public.perfil_solicitacoes add constraint perfil_solicitacoes_tipo_check check (tipo in ('arroba', 'email', 'outro', 'ativacao_sem_vinculo', 'ativacao_ajuda'));
alter table public.perfil_solicitacoes drop column if exists sem_prova;
drop table public.cadastro_tarefas;

do $$
begin
  if pg_get_functiondef('public.trg_joiners_protege_colunas()'::regprocedure) ~ 'anticeg.salvar_cadastro' then raise exception 'A trava de colunas não voltou ao texto anterior. Transação desfeita.'; end if;
  if to_regprocedure('public.perfil_sync_marcar(bigint, boolean, text)') is null then raise exception 'perfil_sync_marcar não voltou. Transação desfeita.'; end if;
  insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('E1', 'revertida', 'sim');
end $$;
commit;
