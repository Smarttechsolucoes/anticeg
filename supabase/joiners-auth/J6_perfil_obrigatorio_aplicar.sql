-- J6 — CONCLUSÃO OBRIGATÓRIA DO PERFIL, HISTÓRICO, SOLICITAÇÕES À ADMINISTRAÇÃO E TROCA DE E-MAIL VERIFICADA
-- Depois de ativar a conta (J1), a pessoa precisa CONCLUIR o perfil (nome para claim = joiners.nome_site; @ só CONFIRMADO, nunca editado aqui; e-mail confirmado). Enquanto não concluir:
--   a conta fica sem acesso a dado nenhum, no SERVIDOR: meu_cog() e meu_joiner_id() (base de todas as políticas) passam a devolver nulo até contas_joiner.perfil_concluido_em existir.
-- Também cria: histórico de alterações de perfil, pedidos de correção à administração (@, e-mail, outro), troca de e-mail VERIFICADA (o banco só troca o e-mail do cadastro quando o Auth já confirmou o endereço novo
-- e ele não pertence a outro cadastro) e a fila de saída para a planilha (reprocessável). joiners.id continua sendo o vínculo da conta; joiners.cog NÃO é alterado em nenhum caso.
-- CONFIRMAÇÃO DO VÍNCULO: e-mail válido e único, e a fotografia da J1d, NÃO provam identidade. Só recebe código (e só liga a conta ao cadastro) quem tem o vínculo CONFIRMADO: por evidência independente
--   (o e-mail do banco confere com o de uma VERSÃO HISTÓRICA (anterior a 17/08/2026) da aba Dados, importado pelo SQL gerado por confirmar-vinculos.mjs) ou por confirmação da administração (por um canal conhecido, com anotação). A confirmação vale só enquanto o e-mail e o @ do cadastro forem os confirmados.
-- APLICAR NO CORTE (junto com o site novo): antes disso a página /piloto-senha/ usa meu_cog() para saber se a conta está ativa. Pré-requisitos: J1, J1d. Uma transação; se algo falhar: "Nada foi alterado".
begin;
create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
begin
  if to_regclass('public.contas_joiner') is null or to_regprocedure('public.meu_cog()') is null then raise exception 'J1 não está aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('emergencia.papel_confiavel()') is null then raise exception 'J1d não está aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'public.is_admin() não existe. Nada foi alterado.'; end if;
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J6') then raise exception 'J6 já foi aplicado. Nada foi alterado.'; end if;
end $$;
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values
  ('J6', 'funcao meu_cog', pg_get_functiondef('public.meu_cog()'::regprocedure)),
  ('J6', 'funcao meu_joiner_id', pg_get_functiondef('public.meu_joiner_id()'::regprocedure)),
  ('J6', 'funcao papel_confiavel', pg_get_functiondef('emergencia.papel_confiavel()'::regprocedure)),
  ('J6', 'funcao ativar_minha_conta', pg_get_functiondef('public.ativar_minha_conta(text)'::regprocedure));

-- 1) a conclusão do perfil é um estado da CONTA
alter table public.contas_joiner add column perfil_concluido_em timestamptz;

-- 2) meu_cog()/meu_joiner_id(): só valem para conta com perfil concluído (todas as políticas e funções de acesso passam a respeitar isso)
create or replace function public.meu_cog() returns text language sql stable security definer set search_path = '' as $$
  select j.cog from public.contas_joiner c join public.joiners j on j.id = c.joiner_id where c.user_id = (select auth.uid()) and c.perfil_concluido_em is not null
$$;
create or replace function public.meu_joiner_id() returns bigint language sql stable security definer set search_path = '' as $$
  select c.joiner_id from public.contas_joiner c where c.user_id = (select auth.uid()) and c.perfil_concluido_em is not null
$$;

-- 3) sinal local à transação: só funções do servidor que VERIFICARAM a pessoa o ligam (o J1d o respeita)
create or replace function emergencia.papel_confiavel() returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_papel text := coalesce(nullif(nullif(current_setting('role', true), 'none'), ''), '');
begin
  if coalesce(current_setting('anticeg.perfil_autorizado', true), '') = '1' then return true; end if;
  if v_papel = '' then
    begin v_papel := coalesce(nullif((current_setting('request.jwt.claims', true))::jsonb ->> 'role', ''), ''); exception when others then v_papel := ''; end;
  end if;
  return v_papel in ('service_role', 'postgres', 'supabase_admin', '') or (v_papel = 'authenticated' and (select public.is_admin()));
end $$;

-- 4) estado da MINHA conta (para a tela): vale antes e depois da conclusão; só mostra o e-mail mascarado
create function public.meu_estado_conta() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('vinculada', true, 'concluido', c.perfil_concluido_em is not null, 'joiner_id', j.id, 'cog', j.cog, 'nome_site', j.nome_site, 'arroba', j.twitter,
           'email_mascarado', case when coalesce(btrim(j.email), '') = '' then null else left(split_part(lower(btrim(j.email)), '@', 1), 1) || '***@' || split_part(lower(btrim(j.email)), '@', 2) end)
    from public.contas_joiner c join public.joiners j on j.id = c.joiner_id where c.user_id = (select auth.uid())), jsonb_build_object('vinculada', false))
$$;
revoke all on function public.meu_estado_conta() from public, anon;
grant execute on function public.meu_estado_conta() to authenticated, service_role;

-- 5) histórico de alterações de perfil
create table public.joiner_perfil_historico (
  id bigint generated always as identity primary key, joiner_id bigint not null, campo text not null, valor_antigo text, valor_novo text, origem text not null, quem uuid, em timestamptz not null default now()
);
create index joiner_perfil_historico_joiner on public.joiner_perfil_historico (joiner_id, em desc);
alter table public.joiner_perfil_historico enable row level security;
revoke all on table public.joiner_perfil_historico from public, anon, authenticated;
grant select on table public.joiner_perfil_historico to authenticated;
grant select, insert on table public.joiner_perfil_historico to service_role;
create policy joiner_perfil_historico_admin on public.joiner_perfil_historico for select to authenticated using ((select public.is_admin()));

create function emergencia.joiners_historico() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_origem text;
begin
  v_origem := case when coalesce(current_setting('anticeg.perfil_autorizado', true), '') = '1' then 'conta_verificada' when emergencia.papel_confiavel() then 'administracao_ou_servidor' else 'site' end;
  if new.nome_site is distinct from old.nome_site then insert into public.joiner_perfil_historico (joiner_id, campo, valor_antigo, valor_novo, origem, quem) values (new.id, 'nome_site', old.nome_site, new.nome_site, v_origem, (select auth.uid())); end if;
  if new.nome is distinct from old.nome then insert into public.joiner_perfil_historico (joiner_id, campo, valor_antigo, valor_novo, origem, quem) values (new.id, 'nome', old.nome, new.nome, v_origem, (select auth.uid())); end if;
  if new.twitter is distinct from old.twitter then insert into public.joiner_perfil_historico (joiner_id, campo, valor_antigo, valor_novo, origem, quem) values (new.id, 'twitter', old.twitter, new.twitter, v_origem, (select auth.uid())); end if;
  if new.email is distinct from old.email then insert into public.joiner_perfil_historico (joiner_id, campo, valor_antigo, valor_novo, origem, quem) values (new.id, 'email', old.email, new.email, v_origem, (select auth.uid())); end if;
  return null;
end $$;
revoke all on function emergencia.joiners_historico() from public, anon, authenticated;
create trigger joiners_historico after update of nome, nome_site, twitter, email on public.joiners for each row execute function emergencia.joiners_historico();

-- 6) concluir / atualizar o perfil (nome para claim). O @ NÃO é aceito aqui: só confirmado.
create function public.completar_meu_perfil(p_nome_site text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_j bigint; v_nome text := btrim(coalesce(p_nome_site, ''));
begin
  if v_uid is null then raise exception 'entre na sua conta'; end if;
  select c.joiner_id into v_j from public.contas_joiner c where c.user_id = v_uid;
  if v_j is null then raise exception 'esta conta ainda não está vinculada a um cadastro'; end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 60 or v_nome ~ '[<>\u0000-\u001f]' then raise exception 'nome inválido: use de 2 a 60 caracteres, sem < > nem caracteres de controle'; end if;
  update public.joiners set nome_site = v_nome where id = v_j and nome_site is distinct from v_nome;
  update public.contas_joiner set perfil_concluido_em = coalesce(perfil_concluido_em, now()) where user_id = v_uid;
  return public.meu_estado_conta();
end $$;
revoke all on function public.completar_meu_perfil(text) from public, anon;
grant execute on function public.completar_meu_perfil(text) to authenticated, service_role;

-- 7) pedidos à administração (correção de @, e-mail, vínculo que não pôde ser confirmado, outro)
create table public.perfil_solicitacoes (
  id bigint generated always as identity primary key, joiner_id bigint, user_id uuid,
  tipo text not null check (tipo in ('arroba', 'email', 'outro', 'ativacao_sem_vinculo', 'ativacao_ajuda')), cog_informado text,
  valor_pedido text, mensagem text, status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'recusada')),
  criado_em timestamptz not null default now(), resolvido_por uuid, resolvido_em timestamptz, nota text
);
create index perfil_solicitacoes_abertas on public.perfil_solicitacoes (status, criado_em);
alter table public.perfil_solicitacoes enable row level security;
revoke all on table public.perfil_solicitacoes from public, anon, authenticated;
grant select on table public.perfil_solicitacoes to authenticated;
grant select, insert, update on table public.perfil_solicitacoes to service_role;
create policy perfil_solicitacoes_propria on public.perfil_solicitacoes for select to authenticated using (user_id = (select auth.uid()));
create policy perfil_solicitacoes_admin on public.perfil_solicitacoes for select to authenticated using ((select public.is_admin()));

create function public.solicitar_correcao_perfil(p_tipo text, p_valor text, p_mensagem text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_j bigint; v_valor text := left(btrim(coalesce(p_valor, '')), 120); v_msg text := left(btrim(coalesce(p_mensagem, '')), 500);
begin
  if v_uid is null then raise exception 'entre na sua conta'; end if;
  if p_tipo is null or p_tipo not in ('arroba', 'email', 'outro') then raise exception 'tipo de pedido inválido'; end if;
  select c.joiner_id into v_j from public.contas_joiner c where c.user_id = v_uid;
  if v_j is null then raise exception 'esta conta ainda não está vinculada a um cadastro'; end if;
  if v_valor ~ '[<>\u0000-\u001f]' or v_msg ~ '[<>\u0000-\u001f]' then raise exception 'texto inválido'; end if;
  if p_tipo in ('arroba', 'email') and v_valor = '' then raise exception 'informe o valor desejado'; end if;
  if (select count(*) from public.perfil_solicitacoes s where s.user_id = v_uid and s.status = 'aberta') >= 3 then raise exception 'você já tem pedidos abertos; aguarde a administração'; end if;
  insert into public.perfil_solicitacoes (joiner_id, user_id, tipo, valor_pedido, mensagem) values (v_j, v_uid, p_tipo, nullif(v_valor, ''), nullif(v_msg, ''));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.solicitar_correcao_perfil(text, text, text) from public, anon;
grant execute on function public.solicitar_correcao_perfil(text, text, text) to authenticated, service_role;

create function public.admin_perfil_solicitacoes() returns table (id bigint, joiner_id bigint, cog text, tipo text, valor_pedido text, mensagem text, status text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  return query select s.id, s.joiner_id, j.cog::text, s.tipo::text, s.valor_pedido::text, s.mensagem::text, s.status::text, s.criado_em from public.perfil_solicitacoes s left join public.joiners j on j.id = s.joiner_id order by (s.status = 'aberta') desc, s.criado_em desc limit 500;
end $$;
revoke all on function public.admin_perfil_solicitacoes() from public, anon;
grant execute on function public.admin_perfil_solicitacoes() to authenticated, service_role;

create function public.admin_resolver_solicitacao(p_id bigint, p_status text, p_nota text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  if p_status not in ('resolvida', 'recusada') then raise exception 'status inválido'; end if;
  update public.perfil_solicitacoes set status = p_status, nota = left(btrim(coalesce(p_nota, '')), 500), resolvido_por = (select auth.uid()), resolvido_em = now() where id = p_id and status = 'aberta';
end $$;
revoke all on function public.admin_resolver_solicitacao(bigint, text, text) from public, anon;
grant execute on function public.admin_resolver_solicitacao(bigint, text, text) to authenticated, service_role;

-- 8) fila de saída para a planilha (reprocessável; idempotente)
create table public.perfil_sync_pendente (
  id bigint generated always as identity primary key, joiner_id bigint not null, tipo text not null check (tipo in ('email')), dados jsonb not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou', 'cancelado')), tentativas integer not null default 0, ultimo_erro text,
  criado_em timestamptz not null default now(), tentado_em timestamptz, enviado_em timestamptz
);
create unique index perfil_sync_pendente_unico on public.perfil_sync_pendente (joiner_id, tipo, (dados::text)) where status in ('pendente', 'falhou');
alter table public.perfil_sync_pendente enable row level security;
revoke all on table public.perfil_sync_pendente from public, anon, authenticated;
grant select, insert, update on table public.perfil_sync_pendente to service_role;
create function public.admin_perfil_sync_pendentes() returns table (id bigint, joiner_id bigint, cog text, tipo text, status text, tentativas integer, ultimo_erro text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  return query select p.id, p.joiner_id, j.cog::text, p.tipo::text, p.status::text, p.tentativas, p.ultimo_erro::text, p.criado_em from public.perfil_sync_pendente p left join public.joiners j on j.id = p.joiner_id order by (p.status in ('pendente', 'falhou')) desc, p.criado_em desc limit 300;
end $$;
revoke all on function public.admin_perfil_sync_pendentes() from public, anon;
grant execute on function public.admin_perfil_sync_pendentes() to authenticated, service_role;
create function public.admin_reprocessar_perfil_sync(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  update public.perfil_sync_pendente set status = 'pendente', tentativas = 0, ultimo_erro = null, tentado_em = null where id = p_id and status in ('falhou', 'pendente');
end $$;
revoke all on function public.admin_reprocessar_perfil_sync(bigint) from public, anon;
grant execute on function public.admin_reprocessar_perfil_sync(bigint) to authenticated, service_role;
-- uso do servidor (função perfil-sync): próximos itens e marcação do resultado
create function public.perfil_sync_proximos(p_limite integer default 10) returns table (id bigint, joiner_id bigint, tipo text, dados jsonb, tentativas integer)
language sql security definer set search_path = '' as $$
  select p.id, p.joiner_id, p.tipo, p.dados, p.tentativas from public.perfil_sync_pendente p
   where p.status in ('pendente', 'falhou') and p.tentativas < 6 and (p.tentado_em is null or p.tentado_em < now() - (interval '2 minutes' * power(2, p.tentativas)))
   order by p.criado_em limit greatest(1, least(coalesce(p_limite, 10), 50))
$$;
create function public.perfil_sync_marcar(p_id bigint, p_ok boolean, p_erro text) returns void language sql security definer set search_path = '' as $$
  update public.perfil_sync_pendente set tentativas = tentativas + 1, tentado_em = now(), status = case when p_ok then 'enviado' else 'falhou' end,
         enviado_em = case when p_ok then now() else enviado_em end, ultimo_erro = case when p_ok then null else left(coalesce(p_erro, 'erro'), 300) end where id = p_id
$$;
revoke all on function public.perfil_sync_proximos(integer), public.perfil_sync_marcar(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.perfil_sync_proximos(integer), public.perfil_sync_marcar(bigint, boolean, text) to service_role;

-- 9) TROCA DE E-MAIL VERIFICADA: o Auth só altera auth.users.email depois que o endereço NOVO foi confirmado; aqui o banco recusa se o endereço pertence a outro cadastro
--    e, só então, troca joiners.email (com o sinal local), atualiza a fotografia (J1d) e enfileira a planilha.
create function emergencia.auth_email_antes() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_j bigint;
begin
  if new.email is distinct from old.email then
    select c.joiner_id into v_j from public.contas_joiner c where c.user_id = new.id;
    if v_j is not null and exists (select 1 from public.joiners j where lower(btrim(coalesce(j.email, ''))) = lower(btrim(new.email)) and j.id <> v_j) then
      raise exception 'Este e-mail já pertence a outro cadastro. Peça a correção à administração.';
    end if;
  end if;
  return new;
end $$;
create function emergencia.auth_email_depois() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_j bigint; v_tw text;
begin
  if new.email is distinct from old.email and new.email_confirmed_at is not null then
    select c.joiner_id into v_j from public.contas_joiner c where c.user_id = new.id;
    if v_j is not null then
      perform set_config('anticeg.perfil_autorizado', '1', true);
      update public.joiners set email = lower(btrim(new.email)) where id = v_j and lower(btrim(coalesce(email, ''))) is distinct from lower(btrim(new.email));
      perform set_config('anticeg.perfil_autorizado', '', true);
      select coalesce(nullif(btrim(twitter), ''), cog) into v_tw from public.joiners where id = v_j;
      insert into public.perfil_sync_pendente (joiner_id, tipo, dados) values (v_j, 'email', jsonb_build_object('twitter', v_tw, 'email_novo', lower(btrim(new.email)))) on conflict do nothing;
    end if;
  end if;
  return null;
end $$;
revoke all on function emergencia.auth_email_antes(), emergencia.auth_email_depois() from public, anon, authenticated;
create trigger anticeg_auth_email_antes before update of email on auth.users for each row execute function emergencia.auth_email_antes();
create trigger anticeg_auth_email_depois after update of email on auth.users for each row execute function emergencia.auth_email_depois();

-- 9b) CONFIRMAÇÃO DO VÍNCULO (evidência independente ou confirmação administrativa); vale só para o e-mail e o @ confirmados
create table public.vinculo_confirmacoes (
  joiner_id bigint primary key references public.joiners (id) on delete cascade,
  fonte text not null check (fonte in ('planilha', 'administracao')),
  nota text, confirmado_por uuid, confirmado_em timestamptz not null default now(),
  email_hash text not null, arroba_hash text not null
);
alter table public.vinculo_confirmacoes enable row level security;
revoke all on table public.vinculo_confirmacoes from public, anon, authenticated;
grant select on table public.vinculo_confirmacoes to authenticated;
grant select, insert, update, delete on table public.vinculo_confirmacoes to service_role;
create policy vinculo_confirmacoes_admin on public.vinculo_confirmacoes for select to authenticated using ((select public.is_admin()));
-- o vínculo está LIBERADO? Sempre exige que o e-mail e o @ do cadastro sejam IGUAIS à fotografia da J1d (nada foi trocado por visitante depois dela) e vale por UM destes caminhos:
--   (1) confirmação da administração/planilha, válida enquanto e-mail e @ forem os confirmados; ou
--   (2) AUTOMÁTICO (decisão de 08/11/2026, risco residual de troca ANTIGA e não detectada aceito pela administradora): e-mail válido e EXCLUSIVO deste cadastro, @ ÚNICO
--       (sem outro que só mude em maiúsculas) e SEM alteração de E-MAIL registrada pelo site (joiner_updates com a chave 'email'; confirmacoes, que grava @ e e-mail juntos, não distingue o tipo).
--       Mudança apenas do @ NÃO bloqueia (o código vai ao e-mail gravado, que não mudou). Os registros não dizem se uma troca de e-mail foi verificada ou administrativa (a Perfil/confirmação identificam só pelo @): por isso toda troca de e-mail registrada fica com a administração.
-- Ficam para a administração: e-mail ausente/inválido/compartilhado, @ duplicado, troca de e-mail registrada e quem perdeu o acesso ao e-mail (pede ajuda). O código vai só ao e-mail do cadastro.
create function public.vinculo_liberado(p_joiner_id bigint) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.joiners j
                   join emergencia.emails_confiaveis t on t.joiner_id = j.id and t.email_hash = emergencia.h(j.email) and t.arroba_hash = emergencia.h_arroba(j.twitter)
                  where j.id = p_joiner_id
                    and (exists (select 1 from public.vinculo_confirmacoes v where v.joiner_id = j.id and v.email_hash = t.email_hash and v.arroba_hash = t.arroba_hash)
                         or (lower(btrim(coalesce(j.email, ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
                             and (select count(*) from public.joiners k where lower(btrim(coalesce(k.email, ''))) = lower(btrim(j.email))) = 1
                             and (select count(*) from public.joiners k where public.norm_arroba(k.cog) = public.norm_arroba(j.cog)) = 1
                             and not exists (select 1 from public.joiner_updates u where lower(btrim(u.joiner_cog)) = lower(btrim(j.cog)) and u.campos ? 'email')
                             and not exists (select 1 from public.confirmacoes c where lower(btrim(c.joiner_cog)) = lower(btrim(j.cog)) and (coalesce(c.email_novo, '') <> '' or coalesce(c.twitter_novo, '') <> '')))))
$$;
revoke all on function public.vinculo_liberado(bigint) from public, anon, authenticated;
grant execute on function public.vinculo_liberado(bigint) to service_role;
create function public.admin_confirmar_vinculo(p_joiner_id bigint, p_nota text, p_email_informado text) returns void language plpgsql security definer set search_path = '' as $$
declare v_nota text := btrim(coalesce(p_nota, ''));
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  if char_length(v_nota) < 5 then raise exception 'anote como a pessoa foi confirmada (canal e data), com pelo menos 5 caracteres'; end if;
  if not exists (select 1 from public.joiners j where j.id = p_joiner_id and lower(btrim(coalesce(j.email, ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$') then raise exception 'cadastro inexistente ou sem e-mail válido'; end if;
  if (select count(*) from public.joiners j2 where lower(btrim(j2.email)) = (select lower(btrim(email)) from public.joiners where id = p_joiner_id)) > 1 then raise exception 'e-mail dividido com outro cadastro: resolva antes (trocar e-mail)'; end if;
  -- o ENDEREÇO COMPLETO informado pela pessoa (canal conhecido) precisa ser igual ao do cadastro; ele não é guardado nem devolvido
  if lower(btrim(coalesce(p_email_informado, ''))) is distinct from (select lower(btrim(email)) from public.joiners where id = p_joiner_id) then raise exception 'o e-mail informado NÃO é o do cadastro; não confirme (use Trocar e-mail com o e-mail que a pessoa informou)'; end if;
  insert into public.vinculo_confirmacoes (joiner_id, fonte, nota, confirmado_por, email_hash, arroba_hash)
    select j.id, 'administracao', left(v_nota, 300), (select auth.uid()), emergencia.h(j.email), emergencia.h_arroba(j.twitter) from public.joiners j where j.id = p_joiner_id
  on conflict (joiner_id) do update set fonte = 'administracao', nota = excluded.nota, confirmado_por = excluded.confirmado_por, confirmado_em = now(), email_hash = excluded.email_hash, arroba_hash = excluded.arroba_hash;
  -- a fotografia da J1d acompanha a confirmação administrativa (a administradora é papel confiável)
  insert into emergencia.emails_confiaveis (joiner_id, email_hash, arroba_hash, origem)
    select j.id, emergencia.h(j.email), emergencia.h_arroba(j.twitter), 'administracao_ou_servidor' from public.joiners j where j.id = p_joiner_id
  on conflict (joiner_id) do update set email_hash = excluded.email_hash, arroba_hash = excluded.arroba_hash, registrado_em = now(), origem = excluded.origem;
end $$;
revoke all on function public.admin_confirmar_vinculo(bigint, text, text) from public, anon;
grant execute on function public.admin_confirmar_vinculo(bigint, text, text) to authenticated, service_role;
create function public.admin_vinculos_a_confirmar(p_limite integer default 300) returns table (joiner_id bigint, cog text, nome_site text, dominio text, tem_conta boolean, itens integer, pedido_de_ajuda boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_admin()) then raise exception 'somente a administração'; end if;
  return query
  select j.id::bigint, j.cog::text, j.nome_site::text, split_part(lower(btrim(coalesce(j.email, ''))), '@', 2)::text,
         exists (select 1 from public.contas_joiner c where c.joiner_id = j.id),
         (select count(*)::integer from public.masterlist m where lower(btrim(m.cog)) = lower(btrim(j.cog))),
         exists (select 1 from public.perfil_solicitacoes s where s.joiner_id = j.id and s.status = 'aberta' and s.tipo in ('ativacao_ajuda', 'ativacao_sem_vinculo'))
    from public.joiners j
   where not public.vinculo_liberado(j.id) and j.cog not like 'zz-teste-%'
   order by exists (select 1 from public.perfil_solicitacoes s where s.joiner_id = j.id and s.status = 'aberta' and s.tipo in ('ativacao_ajuda', 'ativacao_sem_vinculo')) desc, (select count(*) from public.masterlist m where lower(btrim(m.cog)) = lower(btrim(j.cog))) desc, j.id
   limit greatest(1, least(coalesce(p_limite, 300), 700));
end $$;
revoke all on function public.admin_vinculos_a_confirmar(integer) from public, anon;
grant execute on function public.admin_vinculos_a_confirmar(integer) to authenticated, service_role;

-- 10) para as funções pedir-codigo-joiner e pedir-ajuda: o vínculo está LIBERADO? E registro, para a administração, de quem não pôde ser confirmado
create function public.ativacao_vinculo_confiavel(p_joiner_id bigint) returns boolean language sql stable security definer set search_path = '' as $$
  select public.vinculo_liberado(p_joiner_id)
$$;
create function public.registrar_ativacao_sem_vinculo(p_joiner_id bigint, p_motivo text) returns void language sql security definer set search_path = '' as $$
  insert into public.perfil_solicitacoes (joiner_id, tipo, mensagem)
  select p_joiner_id, 'ativacao_sem_vinculo', left(coalesce(p_motivo, 'vínculo não confiável'), 200)
   where not exists (select 1 from public.perfil_solicitacoes s where s.joiner_id = p_joiner_id and s.tipo = 'ativacao_sem_vinculo' and s.criado_em > now() - interval '24 hours')
$$;
create function public.registrar_pedido_ajuda_ativacao(p_joiner_id bigint, p_cog_informado text, p_contato text, p_mensagem text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.perfil_solicitacoes s where s.tipo = 'ativacao_ajuda' and s.status = 'aberta' and s.criado_em > now() - interval '24 hours' and (case when p_joiner_id is not null then s.joiner_id = p_joiner_id else (s.joiner_id is null and s.cog_informado = left(btrim(coalesce(p_cog_informado, '')), 64)) end)) then return; end if;
  insert into public.perfil_solicitacoes (joiner_id, tipo, cog_informado, valor_pedido, mensagem)
  values (p_joiner_id, 'ativacao_ajuda', left(btrim(coalesce(p_cog_informado, '')), 64), left(btrim(coalesce(p_contato, '')), 120), left(btrim(coalesce(p_mensagem, '')), 500));
end $$;
revoke all on function public.registrar_pedido_ajuda_ativacao(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_pedido_ajuda_ativacao(bigint, text, text, text) to service_role;
revoke all on function public.ativacao_vinculo_confiavel(bigint), public.registrar_ativacao_sem_vinculo(bigint, text) from public, anon, authenticated;
grant execute on function public.ativacao_vinculo_confiavel(bigint), public.registrar_ativacao_sem_vinculo(bigint, text) to service_role;

-- 10b) a ativação exige o vínculo LIBERADO (confirmado); nova pendência 'vinculo_nao_confirmado'
alter table public.vinculos_pendentes drop constraint if exists vinculos_pendentes_motivo_check;
alter table public.vinculos_pendentes add constraint vinculos_pendentes_motivo_check
  check (motivo in ('cog_inexistente', 'cog_ambiguo', 'email_ausente', 'email_invalido', 'email_diferente', 'email_compartilhado', 'cog_ja_vinculado', 'email_alterado', 'vinculo_nao_confirmado'));
do $$
declare v_def text := pg_get_functiondef('public.ativar_minha_conta(text)'::regprocedure); v_novo text;
begin
  v_novo := replace(v_def, E'    elsif exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then v_motivo := ''cog_ja_vinculado'';',
                           E'    elsif not public.vinculo_liberado(v_j.id) then v_motivo := ''vinculo_nao_confirmado'';\n    elsif exists (select 1 from public.contas_joiner c where c.joiner_id = v_j.id) then v_motivo := ''cog_ja_vinculado'';');
  if v_novo = v_def then raise exception 'Não consegui acrescentar a condição em ativar_minha_conta (texto inesperado). Nada foi alterado.'; end if;
  -- ativação bem-sucedida: o pedido de ligação que ficou aberto numa tentativa anterior (ex.: 'vinculo_nao_confirmado') é encerrado e não sobra no painel
  v_def := v_novo;
  v_novo := replace(v_def, E'      insert into public.contas_joiner (user_id, joiner_id, origem) values (v_uid, v_j.id, ''email_verificado'');',
                           E'      insert into public.contas_joiner (user_id, joiner_id, origem) values (v_uid, v_j.id, ''email_verificado'');\n      update public.vinculos_pendentes set status = ''aprovado'', resolvido_em = now() where user_id = v_uid and status = ''aberto'';');
  if v_novo = v_def then raise exception 'Não consegui acrescentar o encerramento do pedido aberto em ativar_minha_conta (texto inesperado). Nada foi alterado.'; end if;
  execute v_novo;
end $$;

-- 11) conferências antes do COMMIT
do $$
declare n bigint;
begin
  select count(*) into n from public.contas_joiner where perfil_concluido_em is not null;
  if n <> 0 then raise exception 'Alguma conta já nasceu com perfil concluído. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.meu_estado_conta()', 'EXECUTE') or has_function_privilege('anon', 'public.completar_meu_perfil(text)', 'EXECUTE') then raise exception 'O visitante executa funções de perfil. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.perfil_solicitacoes', 'SELECT') or has_table_privilege('anon', 'public.perfil_sync_pendente', 'SELECT') or has_table_privilege('authenticated', 'public.perfil_sync_pendente', 'SELECT') then raise exception 'Tabela de perfil aberta demais. Transação desfeita.'; end if;
  if has_function_privilege('authenticated', 'public.ativacao_vinculo_confiavel(bigint)', 'EXECUTE') then raise exception 'ativacao_vinculo_confiavel está aberta à conta logada. Transação desfeita.'; end if;
  if has_function_privilege('anon', 'public.vinculo_liberado(bigint)', 'EXECUTE') or has_function_privilege('authenticated', 'public.vinculo_liberado(bigint)', 'EXECUTE') then raise exception 'vinculo_liberado está aberta. Transação desfeita.'; end if;
  if pg_get_functiondef('public.ativar_minha_conta(text)'::regprocedure) !~ 'vinculo_nao_confirmado' then raise exception 'ativar_minha_conta não exige o vínculo liberado. Transação desfeita.'; end if;
  insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe) values ('J6', 'aplicada', 'sim');
  raise notice 'J6 aplicado: % contas existentes passam a exigir a conclusão do perfil. Nenhum dado foi alterado.', (select count(*) from public.contas_joiner);
end $$;
commit;
