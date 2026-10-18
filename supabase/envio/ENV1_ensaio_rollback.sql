-- ENSAIO (rollback) do ENV1: aplica o pacote DENTRO de uma transação, roda os testes com papéis reais e termina em exceção. Nada permanece.
-- ENV1 — ENVIO NACIONAL: acesso das joiners SEM login/senha, mas com LINK PESSOAL SECRETO (token), e administração preservada. PREPARADO, NÃO APLICADO.
--
-- Modelo de identidade: a joiner abre o link pessoal que a equipe enviou (https://…/envio?acesso=<token>). O token (192 bits, aleatório) é guardado SÓ como hash em emergencia.envio_acessos,
-- tem validade e pode ser revogado. O navegador manda o token no cabeçalho "x-envio-token" de cada consulta; o BANCO resolve o token para o COG da joiner e as policies só liberam as linhas dela.
-- Saber o @ NÃO basta. Sem token válido (visitante, token errado, expirado ou revogado) as tabelas de envio devolvem 0 linhas e recusam escrita.
-- A administração (conta admin, public.is_admin()) mantém acesso TOTAL de leitura e escrita; o servidor (service_role) e o acesso direto do banco também.
-- Nada é apagado nem migrado: as linhas existentes ficam onde estão. Só mudam permissões (policies/grants), 1 bucket novo e funções novas.
-- Transação única com conferência no fim; qualquer falha desfaz tudo. Reversão: ENV1_acesso_reverter.sql (recria as policies e grants originais a partir do backup).
--
-- ORDEM DE USO (ver ENV1_LEIA-ME.md): 1) publicar o front novo (funciona com ou sem este SQL) 2) gerar os links 3) aplicar este SQL 4) sondar como visitante (0 linhas) 5) testar painel e um link.
begin;

do $$ begin
  if to_regprocedure('public.is_admin()') is null or to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'ENV1: funcoes is_admin/cog_e_da_conta ausentes: nada foi alterado.'; end if;
  if to_regnamespace('extensions') is null or to_regprocedure('extensions.digest(text,text)') is null or to_regprocedure('extensions.gen_random_bytes(integer)') is null then raise exception 'ENV1: pgcrypto (schema extensions) ausente: nada foi alterado.'; end if;
  if to_regclass('emergencia.envio_acessos') is not null then raise exception 'ENV1: ja aplicado (emergencia.envio_acessos existe): nada foi alterado.'; end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'envio_solicitacoes' and false) then null; end if;
end $$;

-- 1) BACKUP do estado atual (policies, privilégios e impressão das linhas) — base da reversão
create table emergencia.env1_backup (id bigserial primary key, tipo text not null, tabela text not null, dados jsonb not null, criado_em timestamptz not null default now());
alter table emergencia.env1_backup enable row level security;
revoke all on emergencia.env1_backup from public, anon, authenticated, service_role;
revoke all on sequence emergencia.env1_backup_id_seq from public, anon, authenticated, service_role;
insert into emergencia.env1_backup (tipo, tabela, dados)
select 'policy', tablename, to_jsonb(p) from pg_policies p where schemaname = 'public' and tablename in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios');
insert into emergencia.env1_backup (tipo, tabela, dados)
select 'grant', table_name, jsonb_build_object('grantee', grantee, 'privilege', privilege_type) from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios') and grantee in ('anon','authenticated','public','service_role');
insert into emergencia.env1_backup (tipo, tabela, dados)
select 'rls', c.relname, jsonb_build_object('rls', c.relrowsecurity) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios');
create temp table _antes on commit drop as
select 'envio_solicitacoes' t, count(*) n, md5(coalesce(string_agg(id::text || coalesce(status,'') || coalesce(cpf,'') || coalesce(comprovante_url,''), ',' order by id), '')) h from public.envio_solicitacoes
union all select 'grupos_envio', count(*), md5(coalesce(string_agg(codigo || host_cog || coalesce(cpf,''), ',' order by codigo), '')) from public.grupos_envio
union all select 'joiner_storage', count(*), md5(coalesce(string_agg(id::text || coalesce(foto_url,'') || ativo::text, ',' order by id), '')) from public.joiner_storage
union all select 'envio_requests', count(*), md5(coalesce(string_agg(id::text || coalesce(status,''), ',' order by id), '')) from public.envio_requests
union all select 'envio_rounds', count(*), md5(coalesce(string_agg(id::text || coalesce(status,''), ',' order by id), '')) from public.envio_rounds
union all select 'joiner_conferencias', count(*), md5(coalesce(string_agg(id::text || coalesce(confirmada_em::text,''), ',' order by id), '')) from public.joiner_conferencias
union all select 'rastreios', count(*), md5(coalesce(string_agg(id::text || coalesce(codigo,''), ',' order by id), '')) from public.rastreios;

-- 2) acessos (token): só o hash fica no banco
create table emergencia.envio_acessos (
  id bigserial primary key,
  joiner_cog text not null,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  obs text
);
create index envio_acessos_cog_idx on emergencia.envio_acessos (lower(btrim(joiner_cog)));
alter table emergencia.envio_acessos enable row level security;
revoke all on emergencia.envio_acessos from public, anon, authenticated, service_role;
revoke all on sequence emergencia.envio_acessos_id_seq from public, anon, authenticated, service_role;

-- gerador (uso da equipe técnica, pelo acesso direto ao banco; devolve o token UMA vez). Não é exposto à API.
create function emergencia.gerar_acesso_envio(p_cog text, p_dias integer default 14, p_obs text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if not exists (select 1 from public.joiners j where lower(btrim(j.cog)) = lower(btrim(p_cog))) then raise exception 'joiner inexistente: %', p_cog; end if;
  if p_dias < 1 or p_dias > 60 then raise exception 'validade fora de 1 a 60 dias'; end if;
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into emergencia.envio_acessos (joiner_cog, token_hash, expira_em, obs) values (btrim(p_cog), encode(extensions.digest(t, 'sha256'), 'hex'), now() + make_interval(days => p_dias), p_obs);
  return t;
end $$;
create function emergencia.revogar_acesso_envio(p_cog text) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update emergencia.envio_acessos set revogado_em = now() where lower(btrim(joiner_cog)) = lower(btrim(p_cog)) and revogado_em is null;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function emergencia.gerar_acesso_envio(text, integer, text), emergencia.revogar_acesso_envio(text) from public, anon, authenticated, service_role;

-- 3) identificação: token do cabeçalho -> COG (ou conta logada vinculada)
create function public.envio_token_cog() returns text
language plpgsql stable security definer set search_path = '' as $$
declare h text; tok text; r text;
begin
  begin h := current_setting('request.headers', true); exception when others then return null; end;
  if h is null or h = '' then return null; end if;
  begin tok := (h::json) ->> 'x-envio-token'; exception when others then return null; end;
  if tok is null or length(tok) < 32 or length(tok) > 128 then return null; end if;
  select a.joiner_cog into r from emergencia.envio_acessos a
   where a.token_hash = encode(extensions.digest(tok, 'sha256'), 'hex') and a.revogado_em is null and a.expira_em > now() limit 1;
  return r;
end $$;
create function public.envio_dona(p_cog text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_cog is null then false
              when (select public.envio_token_cog()) is not null and lower(btrim(p_cog)) = lower(btrim((select public.envio_token_cog()))) then true
              else coalesce(public.cog_e_da_conta(p_cog), false) end
$$;
-- quem não sofre as travas de campos: administradora, service_role e o acesso direto ao banco (sem papel de API)
create function public.envio_privilegiado() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.role(), '') in ('', 'service_role') or coalesce(public.is_admin(), false)
$$;
revoke all on function public.envio_token_cog(), public.envio_dona(text), public.envio_privilegiado() from public;
grant execute on function public.envio_token_cog(), public.envio_dona(text), public.envio_privilegiado() to anon, authenticated, service_role;

-- 4) policies: apaga as abertas (guardadas no backup) e cria as novas
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
alter table public.envio_solicitacoes enable row level security;
alter table public.grupos_envio enable row level security;
alter table public.joiner_storage enable row level security;
alter table public.envio_requests enable row level security;
alter table public.envio_rounds enable row level security;
alter table public.joiner_conferencias enable row level security;
alter table public.rastreios enable row level security;
revoke all on table public.envio_solicitacoes, public.grupos_envio, public.joiner_storage, public.envio_requests, public.envio_rounds, public.joiner_conferencias, public.rastreios from anon, public;
grant select, insert, update, delete on table public.envio_solicitacoes, public.grupos_envio, public.joiner_storage, public.envio_requests, public.envio_rounds, public.joiner_conferencias, public.rastreios to authenticated;   -- o que cada um pode é decidido pelas policies abaixo
grant select, insert, update on table public.envio_solicitacoes, public.grupos_envio, public.joiner_conferencias to anon;
grant select, update on table public.joiner_storage to anon;
grant select on table public.envio_requests, public.envio_rounds to anon;

-- administração: acesso total (conta admin)
create policy admin_tudo on public.envio_solicitacoes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_tudo on public.grupos_envio for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_tudo on public.joiner_storage for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_tudo on public.envio_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_tudo on public.envio_rounds for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_tudo on public.joiner_conferencias for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_tudo on public.rastreios for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- joiner (token ou conta): só as linhas dela
create policy dona_le on public.envio_solicitacoes for select to anon, authenticated using (public.envio_dona(joiner_cog));
create policy dona_cria on public.envio_solicitacoes for insert to anon, authenticated with check (public.envio_dona(joiner_cog) and status = 'solicitação de envio');
create policy dona_edita on public.envio_solicitacoes for update to anon, authenticated using (public.envio_dona(joiner_cog)) with check (public.envio_dona(joiner_cog));
create policy host_le on public.grupos_envio for select to anon, authenticated using (public.envio_dona(host_cog));
create policy host_cria on public.grupos_envio for insert to anon, authenticated with check (public.envio_dona(host_cog));
create policy host_edita on public.grupos_envio for update to anon, authenticated using (public.envio_dona(host_cog)) with check (public.envio_dona(host_cog));
create policy dona_le on public.joiner_storage for select to anon, authenticated using (public.envio_dona(joiner_cog));
create policy dona_edita on public.joiner_storage for update to anon, authenticated using (public.envio_dona(joiner_cog)) with check (public.envio_dona(joiner_cog));
create policy dona_le on public.envio_requests for select to anon, authenticated using (public.envio_dona(joiner_cog));
create policy rodadas_leitura on public.envio_rounds for select to anon, authenticated using (true);   -- número e status da rodada: sem dado pessoal
create policy dona_le on public.joiner_conferencias for select to anon, authenticated using (public.envio_dona(joiner_cog));
create policy dona_cria on public.joiner_conferencias for insert to anon, authenticated with check (public.envio_dona(joiner_cog));
create policy dona_edita on public.joiner_conferencias for update to anon, authenticated using (public.envio_dona(joiner_cog)) with check (public.envio_dona(joiner_cog));
-- rastreios: SÓ administração (nenhuma policy para anon/joiner)

-- 5) travas de campos para quem NÃO é privilegiado
create function public.trg_envio_protege() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  livres_insert text[] := array['id','created_at','joiner_cog','joiner_nome','joiner_handle','destinatario','cpf','cep','endereco','numero','complemento','bairro','cidade','estado','itens','metodo','seguro','valor_seguro','status','storage_selecionados','grupo_envio_codigo'];
  livres_update text[] := array['status','modalidade_escolhida','comprovante_url'];
begin
  if public.envio_privilegiado() then return new; end if;
  if tg_op = 'INSERT' then
    if jsonb_strip_nulls(to_jsonb(new) - livres_insert) <> '{}'::jsonb then raise exception 'Alteração não permitida: cotação, rastreio e andamento são da administração.' using errcode = '42501'; end if;
    if new.status is distinct from 'solicitação de envio' then raise exception 'Alteração não permitida: a solicitação nasce como "solicitação de envio".' using errcode = '42501'; end if;
    return new;
  end if;
  if (to_jsonb(new) - livres_update) is distinct from (to_jsonb(old) - livres_update) then raise exception 'Alteração não permitida: cotação, rastreio e dados do pedido são da administração.' using errcode = '42501'; end if;
  if new.modalidade_escolhida is distinct from old.modalidade_escolhida then
    if old.cotacao_opcoes is null or jsonb_typeof(old.cotacao_opcoes::text::jsonb) <> 'array' or new.modalidade_escolhida is null
       or not exists (select 1 from jsonb_array_elements(old.cotacao_opcoes::text::jsonb) o where o = new.modalidade_escolhida::text::jsonb) then
      raise exception 'Alteração não permitida: a modalidade precisa ser uma das opções cotadas.' using errcode = '42501';
    end if;
    if old.status in ('pagamento confirmado','embalando','enviado','cancelado') then raise exception 'Alteração não permitida: o pedido já está em andamento.' using errcode = '42501'; end if;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'cancelado' then
      if old.status in ('pagamento confirmado','embalando','enviado','cancelado') then raise exception 'Alteração não permitida: este pedido não pode mais ser cancelado pelo site.' using errcode = '42501'; end if;
    elsif new.status = 'pagamento em aberto' then
      if old.status not in ('pagamento em aberto') or new.modalidade_escolhida is null then raise exception 'Alteração não permitida: escolha uma das modalidades cotadas.' using errcode = '42501'; end if;
    else
      raise exception 'Alteração não permitida: esse andamento é da administração.' using errcode = '42501';
    end if;
  end if;
  if new.comprovante_url is distinct from old.comprovante_url and (new.comprovante_url is null or new.comprovante_url !~ ('^' || old.id::text || '/comprovante_[0-9]{10,}\.[A-Za-z0-9]{2,5}$')) then
    raise exception 'Alteração não permitida: caminho de comprovante inválido.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_envio_protege_ins before insert on public.envio_solicitacoes for each row execute function public.trg_envio_protege();
create trigger trg_envio_protege_upd before update on public.envio_solicitacoes for each row execute function public.trg_envio_protege();

create function public.trg_storage_protege() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.envio_privilegiado() then return new; end if;
  if (to_jsonb(new) - 'ativo') is distinct from (to_jsonb(old) - 'ativo') or (new.ativo is true and old.ativo is not true) then
    raise exception 'Alteração não permitida: a joiner só pode retirar um item da própria lista.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_storage_protege before update on public.joiner_storage for each row execute function public.trg_storage_protege();

create function public.trg_conferencia_protege() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.envio_privilegiado() then return new; end if;
  if tg_op = 'INSERT' then
    if new.confirmada_em is not null or coalesce(new.prazo_dias, 5) not between 1 and 30 then raise exception 'Alteração não permitida.' using errcode = '42501'; end if;
    return new;
  end if;
  if (to_jsonb(new) - 'confirmada_em') is distinct from (to_jsonb(old) - 'confirmada_em') then raise exception 'Alteração não permitida: só a confirmação é da joiner.' using errcode = '42501'; end if;
  return new;
end $$;
create trigger trg_conferencia_protege_ins before insert on public.joiner_conferencias for each row execute function public.trg_conferencia_protege();
create trigger trg_conferencia_protege_upd before update on public.joiner_conferencias for each row execute function public.trg_conferencia_protege();
revoke all on function public.trg_envio_protege(), public.trg_storage_protege(), public.trg_conferencia_protege() from public, anon, authenticated;

-- 6) funções que a joiner chama (SECURITY DEFINER, exigem token/conta)
create function public.envio_solicitar_rodada(p_itens_manuais text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_cog text; v_round public.envio_rounds; v_pos integer; v_req public.envio_requests;
begin
  v_cog := (select public.envio_token_cog());
  if v_cog is null then v_cog := (select public.meu_cog()); end if;
  if v_cog is null then raise exception 'acesso não identificado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(731100);
  select r.* into v_req from public.envio_requests r join public.envio_rounds g on g.id = r.round_id
   where lower(btrim(r.joiner_cog)) = lower(btrim(v_cog)) and r.status = 'aguardando' and g.status in ('aberto','fechado','em_processo') order by r.id desc limit 1;
  if not found then
    select * into v_round from public.envio_rounds where status = 'aberto' order by created_at asc limit 1;
    if not found then
      insert into public.envio_rounds (numero, status) values (coalesce((select max(numero) from public.envio_rounds), 0) + 1, 'aberto') returning * into v_round;
    end if;
    v_pos := (select count(*) from public.envio_requests where round_id = v_round.id) + 1;
    insert into public.envio_requests (joiner_cog, round_id, posicao_no_round, status, itens_manuais) values (btrim(v_cog), v_round.id, v_pos, 'aguardando', nullif(btrim(coalesce(p_itens_manuais, '')), '')) returning * into v_req;
    if v_pos >= 7 then update public.envio_rounds set status = 'fechado' where id = v_round.id; end if;
  end if;
  return to_jsonb(v_req) || jsonb_build_object('envio_rounds', (select to_jsonb(g) from public.envio_rounds g where g.id = v_req.round_id));
end $$;
create function public.envio_grupo_por_codigo(p_codigo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(g.*) from public.grupos_envio g
   where ((select public.envio_token_cog()) is not null or (select public.meu_cog()) is not null) and g.codigo = upper(btrim(coalesce(p_codigo, ''))) limit 1
$$;
create function public.envio_meu_acesso() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when coalesce((select public.envio_token_cog()), (select public.meu_cog())) is null then null::jsonb
              else jsonb_build_object('cog', coalesce((select public.envio_token_cog()), (select public.meu_cog()))) end
$$;
revoke all on function public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso() from public;
grant execute on function public.envio_solicitar_rodada(text), public.envio_grupo_por_codigo(text), public.envio_meu_acesso() to anon, authenticated, service_role;

-- 7) comprovantes de envio: bucket PRIVADO novo (o bucket público "comprovantes" continua como está para o resto do site)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('envio-comprovantes', 'envio-comprovantes', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;
create function public.envio_solicitacao_existe(p_id text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.envio_solicitacoes e where e.id::text = p_id)
$$;
revoke all on function public.envio_solicitacao_existe(text) from public;
grant execute on function public.envio_solicitacao_existe(text) to anon, authenticated;
-- a policy genérica "allow upload" (anon/authenticated, qualquer bucket exceto anti-store e avatars) deixaria enviar arquivo ao bucket novo por fora das regras abaixo: exclui SÓ o bucket novo (o resto continua igual)
insert into emergencia.env1_backup (tipo, tabela, dados) select 'storage_policy', 'objects', to_jsonb(p) from pg_policies p where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload';
alter policy "allow upload" on storage.objects with check ((bucket_id <> 'anti-store'::text) and (bucket_id <> 'avatars'::text) and (bucket_id <> 'envio-comprovantes'::text));
create policy envio_comprovantes_enviar on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'envio-comprovantes' and name ~ '^[0-9]{1,12}/comprovante_[0-9]{10,}\.(jpg|jpeg|png|webp|heic|heif|pdf)$' and public.envio_solicitacao_existe(split_part(name, '/', 1)));
create policy envio_comprovantes_admin on storage.objects for all to authenticated
  using (bucket_id = 'envio-comprovantes' and (select public.is_admin())) with check (bucket_id = 'envio-comprovantes' and (select public.is_admin()));

-- 8) conferência final
do $$ declare a record; tb text; n integer; begin
  for a in select * from _antes loop
    execute format('select count(*) from public.%I', a.t) into n;
    if n <> a.n then raise exception 'ENV1: a contagem de % mudou (% -> %)', a.t, a.n, n; end if;
  end loop;
  if (select md5(coalesce(string_agg(id::text || coalesce(status,'') || coalesce(cpf,'') || coalesce(comprovante_url,''), ',' order by id), '')) from public.envio_solicitacoes) <> (select z.h from _antes z where z.t = 'envio_solicitacoes') then raise exception 'ENV1: conteudo de envio_solicitacoes mudou'; end if;
  for tb in select unnest(array['envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','envio_rounds','joiner_conferencias','rastreios']) loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || tb)::regclass) then raise exception 'ENV1: RLS desligada em %', tb; end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('envio_solicitacoes','grupos_envio','joiner_storage','envio_requests','rastreios','joiner_conferencias')
              and ('public' = any(roles) or (('anon' = any(roles)) and coalesce(qual, '') !~ 'envio_dona') and (coalesce(with_check, '') !~ 'envio_dona'))) then raise exception 'ENV1: ainda ha policy aberta ao visitante'; end if;
  if exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name = 'rastreios' and grantee in ('anon','public')) then raise exception 'ENV1: rastreios acessivel ao visitante'; end if;
  if has_table_privilege('anon', 'public.envio_solicitacoes', 'DELETE') or has_table_privilege('anon', 'public.joiner_storage', 'DELETE') then raise exception 'ENV1: visitante ainda pode apagar'; end if;
  if (select count(*) from emergencia.env1_backup where tipo = 'policy') < 7 then raise exception 'ENV1: backup de policies incompleto'; end if;
end $$;

-- TESTES do ENV1 (rollback): simulam visitante sem token, token errado/expirado/revogado, joiner com token, conta logada e administradora, usando os PAPÉIS reais do banco (anon / authenticated).
-- Nada permanece: o script termina SEMPRE em exceção. Os dados reais só são CONTADOS (nenhum valor pessoal é lido ou impresso).
do $t$
declare
  res text := ''; ok integer := 0; bad integer := 0;
  v_a text; v_b text; tok_a text; tok_b text; v_total integer; v_exp_a integer; v_exp_b integer; v_st_a integer; v_st_total integer;
  n integer; v_id bigint; v_admin uuid; v_conta uuid; v_conta_cog text; v_grupo text; j jsonb;
  rec record;
  procedure_dummy integer;
  hdr text;
begin
  select joiner_cog into v_a from public.envio_solicitacoes group by 1 order by count(*) desc limit 1;
  select joiner_cog into v_b from public.envio_solicitacoes where lower(btrim(joiner_cog)) <> lower(btrim(v_a)) group by 1 order by count(*) desc limit 1;
  select count(*) into v_total from public.envio_solicitacoes;
  select count(*) into v_exp_a from public.envio_solicitacoes where lower(btrim(joiner_cog)) = lower(btrim(v_a));
  select count(*) into v_exp_b from public.envio_solicitacoes where lower(btrim(joiner_cog)) = lower(btrim(v_b));
  select count(*) into v_st_a from public.joiner_storage where lower(btrim(joiner_cog)) = lower(btrim(v_a));
  select count(*) into v_st_total from public.joiner_storage;
  select codigo into v_grupo from public.grupos_envio limit 1;
  select user_id into v_admin from public.admin_roles where papel = 'admin' limit 1;
  select c.user_id, j2.cog into v_conta, v_conta_cog from public.contas_joiner c join public.joiners j2 on j2.id = c.joiner_id limit 1;
  tok_a := emergencia.gerar_acesso_envio(v_a, 14, 'ensaio');
  tok_b := emergencia.gerar_acesso_envio(v_b, 14, 'ensaio');

  -- ---------- T1..T3: visitante sem token, token errado, token da joiner A
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.headers', '{}', true);
  select count(*) into n from public.envio_solicitacoes;                         if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1 visitante sem token viu ' || n || ' solicitacoes ; '; end if;
  select count(*) into n from public.grupos_envio;                               if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1b grupos ; '; end if;
  select count(*) into n from public.joiner_storage;                             if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1c storage ; '; end if;
  select count(*) into n from public.envio_requests;                             if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1d requests ; '; end if;
  select count(*) into n from public.joiner_conferencias;                        if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T1e conferencias ; '; end if;
  begin select count(*) into n from public.rastreios; bad := bad + 1; res := res || 'FALHA T1f rastreios legivel ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin delete from public.envio_solicitacoes; bad := bad + 1; res := res || 'FALHA T1g visitante apagou ; '; exception when insufficient_privilege then ok := ok + 1; end;
  perform set_config('request.headers', json_build_object('x-envio-token', 'abcdef0123456789abcdef0123456789abcdef0123456789')::text, true);
  select count(*) into n from public.envio_solicitacoes;                         if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T2 token errado viu linhas ; '; end if;

  perform set_config('request.headers', json_build_object('x-envio-token', tok_a)::text, true);
  select count(*) into n from public.envio_solicitacoes;                         if n = v_exp_a and n > 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3 joiner A viu ' || n || ' esperado ' || v_exp_a || ' ; '; end if;
  select count(*) into n from public.envio_solicitacoes where lower(btrim(joiner_cog)) <> lower(btrim(v_a)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3b viu de outra ; '; end if;
  select count(*) into n from public.joiner_storage;                             if n = v_st_a then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T3c storage ' || n || ' esperado ' || v_st_a || ' ; '; end if;
  begin select count(*) into n from public.rastreios; bad := bad + 1; res := res || 'FALHA T3d rastreios ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin select count(*) into n from emergencia.envio_acessos; bad := bad + 1; res := res || 'FALHA T3e tokens legiveis ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin delete from public.envio_solicitacoes where id = -1; bad := bad + 1; res := res || 'FALHA T3f delete ; '; exception when insufficient_privilege then ok := ok + 1; end;

  -- ---------- T4..T9: escrita da joiner A
  begin insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status) values (v_b, 'x', 'x', '0', '0', 'x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'solicitação de envio');
    bad := bad + 1; res := res || 'FALHA T4 inseriu para outra joiner ; ';
  exception when others then ok := ok + 1; end;
  begin insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status, cotacao_valor) values (v_a, 'x', 'x', '0', '0', 'x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'solicitação de envio', '1,00');
    bad := bad + 1; res := res || 'FALHA T4b inseriu com cotacao ; ';
  exception when others then ok := ok + 1; end;
  begin insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status) values (v_a, 'x', 'x', '0', '0', 'x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'enviado');
    bad := bad + 1; res := res || 'FALHA T4c inseriu como enviado ; ';
  exception when others then ok := ok + 1; end;
  insert into public.envio_solicitacoes (joiner_cog, joiner_nome, destinatario, cpf, cep, endereco, numero, bairro, cidade, estado, itens, metodo, seguro, status) values (v_a, 'ENSAIO', 'ENSAIO', '00000000000', '00000000', 'rua x', '1', 'x', 'x', 'SP', '[]', 'PAC', 'nao', 'solicitação de envio') returning id into v_id;
  ok := ok + 1;
  begin update public.envio_solicitacoes set status = 'enviado' where id = v_id; bad := bad + 1; res := res || 'FALHA T5 joiner mudou status para enviado ; '; exception when others then ok := ok + 1; end;
  begin update public.envio_solicitacoes set cotacao_valor = '0,01' where id = v_id; bad := bad + 1; res := res || 'FALHA T5b joiner mexeu em cotacao ; '; exception when others then ok := ok + 1; end;
  begin update public.envio_solicitacoes set cpf = '11111111111' where id = v_id; bad := bad + 1; res := res || 'FALHA T5c joiner alterou CPF apos criar ; '; exception when others then ok := ok + 1; end;
  begin update public.envio_solicitacoes set comprovante_url = 'http://evil' where id = v_id; bad := bad + 1; res := res || 'FALHA T6 comprovante invalido aceito ; '; exception when others then ok := ok + 1; end;
  update public.envio_solicitacoes set comprovante_url = v_id::text || '/comprovante_1760000000000.pdf' where id = v_id; ok := ok + 1;
  begin update public.envio_solicitacoes set modalidade_escolhida = '{"forma":"PAC","valor":"1","prazo":"1 dia"}'::jsonb where id = v_id; bad := bad + 1; res := res || 'FALHA T7 modalidade sem cotacao aceita ; '; exception when others then ok := ok + 1; end;

  -- a administração (acesso direto) cota; depois a joiner escolhe
  execute 'reset role'; perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.envio_solicitacoes set cotacao_opcoes = '[{"forma":"PAC","valor":"20","prazo":"8 dias"},{"forma":"SEDEX","valor":"40","prazo":"3 dias"}]'::jsonb, status = 'pagamento em aberto', cotacao_valor = '20,00' where id = v_id;
  execute 'set local role anon'; perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  begin update public.envio_solicitacoes set modalidade_escolhida = '{"forma":"PAC","valor":"0,01","prazo":"8 dias"}'::jsonb, status = 'pagamento em aberto' where id = v_id; bad := bad + 1; res := res || 'FALHA T8 modalidade com preco adulterado aceita ; '; exception when others then ok := ok + 1; end;
  update public.envio_solicitacoes set modalidade_escolhida = '{"forma":"SEDEX","valor":"40","prazo":"3 dias"}'::jsonb, status = 'pagamento em aberto' where id = v_id; ok := ok + 1;
  update public.envio_solicitacoes set status = 'cancelado' where id = v_id; ok := ok + 1;

  -- ---------- T10..T14: storage, conferência, rodada, grupo
  select count(*) into n from public.joiner_storage where ativo;
  begin update public.joiner_storage set foto_url = 'x' where id = (select min(id) from public.joiner_storage); if found then bad := bad + 1; res := res || 'FALHA T10 joiner trocou foto ; '; else ok := ok + 1; end if; exception when others then ok := ok + 1; end;
  begin update public.joiner_storage set ativo = false where id = (select min(id) from public.joiner_storage where ativo); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T10b joiner nao conseguiu retirar item proprio ; '; end;
  begin delete from public.joiner_storage; bad := bad + 1; res := res || 'FALHA T10c delete storage ; '; exception when insufficient_privilege then ok := ok + 1; end;
  begin insert into public.joiner_storage (joiner_cog, foto_url, descricao) values (v_a, 'x', 'x'); bad := bad + 1; res := res || 'FALHA T10d joiner inseriu storage ; '; exception when others then ok := ok + 1; end;
  begin insert into public.joiner_conferencias (joiner_cog, prazo_dias) values (v_a, 5); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T11 conferencia propria ; '; end;
  begin insert into public.joiner_conferencias (joiner_cog, prazo_dias) values (v_b, 5); bad := bad + 1; res := res || 'FALHA T11b conferencia de outra ; '; exception when others then ok := ok + 1; end;
  j := public.envio_solicitar_rodada('ensaio'); if j ? 'envio_rounds' and (j->>'joiner_cog') = v_a then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T12 rodada ; '; end if;
  if v_grupo is not null then if public.envio_grupo_por_codigo(v_grupo) is not null then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T13 grupo com token ; '; end if; end if;
  begin insert into public.grupos_envio (codigo, host_cog) values ('ZZZZZ1', v_b); bad := bad + 1; res := res || 'FALHA T13b criou grupo para outra ; '; exception when others then ok := ok + 1; end;
  insert into public.grupos_envio (codigo, host_cog, destinatario) values ('ZZZZZ1', v_a, 'ENSAIO'); ok := ok + 1;
  j := public.envio_meu_acesso(); if (j->>'cog') = v_a then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T13c envio_meu_acesso ; '; end if;

  -- ---------- T15: token expirado e revogado
  execute 'reset role'; perform set_config('request.jwt.claims', '{"role":"service_role"}', true); perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into emergencia.envio_acessos (joiner_cog, token_hash, expira_em) values (v_a, encode(extensions.digest('expirado0123456789abcdef0123456789abcdef01', 'sha256'), 'hex'), now() - interval '1 minute');
  insert into emergencia.envio_acessos (joiner_cog, token_hash, expira_em, revogado_em) values (v_a, encode(extensions.digest('revogado0123456789abcdef0123456789abcdef01', 'sha256'), 'hex'), now() + interval '1 day', now());
  execute 'set local role anon'; perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.headers', json_build_object('x-envio-token', 'expirado0123456789abcdef0123456789abcdef01')::text, true);
  select count(*) into n from public.envio_solicitacoes; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T15 token expirado ; '; end if;
  perform set_config('request.headers', json_build_object('x-envio-token', 'revogado0123456789abcdef0123456789abcdef01')::text, true);
  select count(*) into n from public.envio_solicitacoes; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T15b token revogado ; '; end if;
  perform set_config('request.headers', json_build_object('x-envio-token', tok_b)::text, true);
  select count(*) into n from public.envio_solicitacoes where lower(btrim(joiner_cog)) = lower(btrim(v_a)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T16 token de B viu A ; '; end if;
  select count(*) into n from public.envio_solicitacoes; if n = v_exp_b then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T16b B viu ' || n || ' esperado ' || v_exp_b || ' ; '; end if;

  -- ---------- T17: comprovante no bucket privado (regra de caminho/visitante)
  perform set_config('request.headers', json_build_object('x-envio-token', tok_a)::text, true);
  begin insert into storage.objects (bucket_id, name, owner) values ('envio-comprovantes', 'qualquer.txt', null); bad := bad + 1; res := res || 'FALHA T17 caminho livre aceito ; '; exception when others then ok := ok + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('envio-comprovantes', '999999999/comprovante_1760000000000.pdf'); bad := bad + 1; res := res || 'FALHA T17b solicitacao inexistente aceita ; '; exception when others then ok := ok + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('envio-comprovantes', v_id::text || '/comprovante_1760000000001.pdf'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T17c envio valido recusado: ' || sqlerrm || ' ; '; end;
  begin select count(*) into n from storage.objects where bucket_id = 'envio-comprovantes'; if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T17d visitante le comprovantes ; '; end if; exception when others then ok := ok + 1; end;

  -- ---------- T18: administradora (papel authenticated + conta admin) mantém TUDO
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.headers', '{}', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_admin::text, true); perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*) into n from public.envio_solicitacoes; if n >= v_total then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T18 admin ve ' || n || ' de ' || v_total || ' ; '; end if;
  select count(*) into n from public.joiner_storage; if n >= v_st_total then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T18b admin storage ; '; end if;
  select count(*) into n from public.rastreios; ok := ok + 1;
  select count(*) into n from public.grupos_envio; ok := ok + 1;
  begin update public.envio_solicitacoes set status = 'embalando', rastreio_codigo = 'ENSAIO' where id = v_id; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18c admin nao escreve: ' || sqlerrm || ' ; '; end;
  begin insert into public.joiner_storage (joiner_cog, foto_url, descricao) values (v_a, 'ensaio', 'ensaio'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18d admin nao insere storage ; '; end;
  begin insert into public.rastreios (codigo, transportadora) values ('ENSAIO', 'x'); ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18e admin nao insere rastreio: ' || sqlerrm || ' ; '; end;
  begin delete from public.rastreios where codigo = 'ENSAIO'; ok := ok + 1; exception when others then bad := bad + 1; res := res || 'FALHA T18f admin nao apaga ; '; end;
  begin select count(*) into n from storage.objects where bucket_id = 'envio-comprovantes'; if n >= 1 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T18g admin nao le comprovantes ; '; end if; exception when others then bad := bad + 1; res := res || 'FALHA T18g ' || sqlerrm || ' ; '; end;

  -- ---------- T19: conta logada (authenticated, sem admin) vê só o próprio
  if v_conta is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_conta, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', v_conta::text, true);
    select count(*) into n from public.envio_solicitacoes where lower(btrim(joiner_cog)) <> lower(btrim(v_conta_cog)); if n = 0 then ok := ok + 1; else bad := bad + 1; res := res || 'FALHA T19 conta logada viu de outra ; '; end if;
  end if;
  execute 'reset role';
  raise exception E'ENV1_ENSAIO % | aprovados=% falhas=% | %', case when bad = 0 then 'OK' else 'COM FALHAS' end, ok, bad, res;
end $t$;
