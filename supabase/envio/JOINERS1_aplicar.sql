-- JOINERS1 — CPF e ENDEREÇO deixam de ser legíveis/gravaveis pelo VISITANTE na tabela joiners. PREPARADO, NÃO APLICADO. Aplicar DEPOIS do ENV1 (usa o link pessoal).
-- Colunas protegidas (9): cpf, cep, rua, numero, complemento, bairro, cidade, estado, nome_entrega.
-- O visitante continua lendo/gravando as outras colunas (inclusive e-mail e WhatsApp: ver ENVIO_GO_NO-GO.md, item 2b) e o login por @ continua funcionando
-- (o front passa a pedir colunas explícitas em vez de select("*"); o select * deixa de funcionar para o visitante, de propósito).
-- Quem enxerga CPF/endereço: a administração (conta admin), o servidor (service_role) e a PRÓPRIA joiner, pelo link pessoal (envio_meus_dados / envio_salvar_dados).
-- Nenhum dado é alterado, apagado ou movido. Reversão: JOINERS1_reverter.sql (devolve os privilégios originais).
begin;
do $$ begin
  if to_regprocedure('public.envio_token_cog()') is null then raise exception 'JOINERS1: aplique o ENV1 antes (funcao envio_token_cog ausente). Nada foi alterado.'; end if;
  if to_regclass('emergencia.env1_backup') is null then raise exception 'JOINERS1: emergencia.env1_backup ausente. Nada foi alterado.'; end if;
  if exists (select 1 from emergencia.env1_backup where tipo = 'joiners_grant') then raise exception 'JOINERS1: ja aplicado (backup existe). Nada foi alterado.'; end if;
  if not has_table_privilege('anon', 'public.joiners', 'SELECT') then raise exception 'JOINERS1: estado inesperado (anon sem SELECT). Nada foi alterado.'; end if;
end $$;

-- 1) backup dos privilégios atuais (tabela e colunas) e impressão dos dados
insert into emergencia.env1_backup (tipo, tabela, dados)
select 'joiners_grant', 'joiners', jsonb_build_object('grantee', grantee, 'privilege', privilege_type)
  from information_schema.role_table_grants where table_schema = 'public' and table_name = 'joiners' and grantee in ('anon','authenticated','public');
create temp table _antes_j on commit drop as
select count(*) n, md5(coalesce(string_agg(id::text || cog || coalesce(cpf,'') || coalesce(cep,'') || coalesce(email,'') || coalesce(whatsapp,''), ',' order by id), '')) h from public.joiners;

-- 2) o visitante perde SELECT/UPDATE de tabela e recebe de volta SELECT/UPDATE só nas colunas não protegidas (INSERT não muda: o cadastro continua igual)
revoke select, update on public.joiners from anon;
grant select (id, cog, nome, email, twitter, whatsapp, foto_perfil, last_seen, bloqueado, confirmado, last_notified_at, saldo_cashback, nome_site, telefone, recrutador) on public.joiners to anon;
grant update (cog, nome, email, twitter, whatsapp, foto_perfil, last_seen, bloqueado, confirmado, last_notified_at, saldo_cashback, nome_site, telefone, recrutador) on public.joiners to anon;

-- 3) a joiner (pelo link pessoal) grava o próprio CPF/endereço; só estas chaves, tamanho limitado; o servidor decide quem é pela identidade do token/conta
create function public.envio_salvar_dados(p_dados jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_cog text; k text; n integer;
  permitidas text[] := array['nome_entrega','cpf','telefone','cep','rua','numero','complemento','bairro','cidade','estado'];
begin
  v_cog := coalesce((select public.envio_token_cog()), (select public.meu_cog()));
  if v_cog is null then raise exception 'acesso não identificado' using errcode = '42501'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'dados inválidos' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if not (k = any(permitidas)) then raise exception 'campo não permitido: %', k using errcode = '42501'; end if;
    if jsonb_typeof(p_dados -> k) not in ('string', 'null') or length(coalesce(p_dados ->> k, '')) > 200 then raise exception 'valor inválido em %', k using errcode = '22023'; end if;
  end loop;
  update public.joiners set
    nome_entrega = case when p_dados ? 'nome_entrega' then nullif(btrim(p_dados ->> 'nome_entrega'), '') else nome_entrega end,
    cpf          = case when p_dados ? 'cpf'          then nullif(btrim(p_dados ->> 'cpf'), '')          else cpf end,
    telefone     = case when p_dados ? 'telefone'     then nullif(btrim(p_dados ->> 'telefone'), '')     else telefone end,
    cep          = case when p_dados ? 'cep'          then nullif(btrim(p_dados ->> 'cep'), '')          else cep end,
    rua          = case when p_dados ? 'rua'          then nullif(btrim(p_dados ->> 'rua'), '')          else rua end,
    numero       = case when p_dados ? 'numero'       then nullif(btrim(p_dados ->> 'numero'), '')       else numero end,
    complemento  = case when p_dados ? 'complemento'  then nullif(btrim(p_dados ->> 'complemento'), '')  else complemento end,
    bairro       = case when p_dados ? 'bairro'       then nullif(btrim(p_dados ->> 'bairro'), '')       else bairro end,
    cidade       = case when p_dados ? 'cidade'       then nullif(btrim(p_dados ->> 'cidade'), '')       else cidade end,
    estado       = case when p_dados ? 'estado'       then nullif(upper(btrim(p_dados ->> 'estado')), '') else estado end
   where btrim(cog) = btrim(v_cog);
  get diagnostics n = row_count;
  if n = 0 then
    update public.joiners set
      nome_entrega = case when p_dados ? 'nome_entrega' then nullif(btrim(p_dados ->> 'nome_entrega'), '') else nome_entrega end,
      cpf          = case when p_dados ? 'cpf'          then nullif(btrim(p_dados ->> 'cpf'), '')          else cpf end,
      telefone     = case when p_dados ? 'telefone'     then nullif(btrim(p_dados ->> 'telefone'), '')     else telefone end,
      cep          = case when p_dados ? 'cep'          then nullif(btrim(p_dados ->> 'cep'), '')          else cep end,
      rua          = case when p_dados ? 'rua'          then nullif(btrim(p_dados ->> 'rua'), '')          else rua end,
      numero       = case when p_dados ? 'numero'       then nullif(btrim(p_dados ->> 'numero'), '')       else numero end,
      complemento  = case when p_dados ? 'complemento'  then nullif(btrim(p_dados ->> 'complemento'), '')  else complemento end,
      bairro       = case when p_dados ? 'bairro'       then nullif(btrim(p_dados ->> 'bairro'), '')       else bairro end,
      cidade       = case when p_dados ? 'cidade'       then nullif(btrim(p_dados ->> 'cidade'), '')       else cidade end,
      estado       = case when p_dados ? 'estado'       then nullif(upper(btrim(p_dados ->> 'estado')), '') else estado end
     where lower(btrim(cog)) = lower(btrim(v_cog)) and (select count(*) from public.joiners z where lower(btrim(z.cog)) = lower(btrim(v_cog))) = 1;
    get diagnostics n = row_count;
  end if;
  return n = 1;
end $$;
revoke all on function public.envio_salvar_dados(jsonb) from public;
grant execute on function public.envio_salvar_dados(jsonb) to anon, authenticated, service_role;

-- 4) conferência
do $$ declare a record; c text; begin
  select * into a from _antes_j;
  if (select count(*) from public.joiners) <> a.n then raise exception 'JOINERS1: a contagem de joiners mudou'; end if;
  if (select md5(coalesce(string_agg(id::text || cog || coalesce(cpf,'') || coalesce(cep,'') || coalesce(email,'') || coalesce(whatsapp,''), ',' order by id), '')) from public.joiners) <> a.h then raise exception 'JOINERS1: o conteudo de joiners mudou'; end if;
  foreach c in array array['cpf','cep','rua','numero','complemento','bairro','cidade','estado','nome_entrega'] loop
    if has_column_privilege('anon', 'public.joiners', c, 'SELECT') or has_column_privilege('anon', 'public.joiners', c, 'UPDATE') then raise exception 'JOINERS1: o visitante ainda acessa a coluna %', c; end if;
  end loop;
  foreach c in array array['id','cog','nome','email','twitter','whatsapp','foto_perfil','last_seen','bloqueado','confirmado','last_notified_at','saldo_cashback','nome_site','telefone','recrutador'] loop
    if not has_column_privilege('anon', 'public.joiners', c, 'SELECT') then raise exception 'JOINERS1: o visitante perdeu a leitura da coluna publica %', c; end if;
  end loop;
  if not has_table_privilege('anon', 'public.joiners', 'INSERT') then raise exception 'JOINERS1: o cadastro (INSERT) foi afetado'; end if;
  if not has_table_privilege('authenticated', 'public.joiners', 'SELECT') then raise exception 'JOINERS1: a administracao perdeu a leitura'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'joiners') <> 24 then raise exception 'JOINERS1: a tabela joiners tem colunas que nao constam da lista (revisar as listas de colunas)'; end if;
end $$;
commit;
