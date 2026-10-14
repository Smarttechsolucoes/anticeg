-- J5 — COMPROVANTES PRIVADOS: os buckets comprovantes e mercari-comprovantes deixam de ser públicos
-- Hoje o link de cada comprovante (PIX, repasse, envio, lojas, Mercari) abre para QUALQUER pessoa que o tenha, e qualquer visitante pode ENVIAR arquivos para esses buckets e para
-- avatars, fotos-itens e storage-itens (a policy "allow upload" vale para todos os buckets, inclusive para visitante). Depois deste passo:
--   comprovantes, mercari-comprovantes : bucket PRIVADO (os links antigos "públicos" deixam de abrir sozinhos), só imagens e PDF, até 10 MB por arquivo.
--       ENVIAR: só pela função comprovante-upload, que autoriza um arquivo por vez (conferindo caminho, tipo, tamanho e limite por hora) e nunca sobrescreve outro.
--       VER: só pela função comprovante-url, que devolve um link assinado de 10 minutos para a administradora ou para a DONA do arquivo (comprovante_assinavel confere a dona registrada).
--   avatars, fotos-itens, storage-itens : continuam públicos para ver; só conta ATIVADA (vinculada a uma joiner) ou a administradora envia. Visitante e conta sem vínculo não enviam mais
--       (importante: com o cadastro de usuários do Auth ligado, QUALQUER pessoa consegue criar uma conta; só a vinculada a uma joiner pode enviar arquivos).
-- Nenhum arquivo é movido, apagado ou renomeado; as URLs gravadas nos pedidos continuam as mesmas (a leitura passa a ser assinada pelo site novo).
-- ⚠ APLICAR SOMENTE NO LANÇAMENTO, junto com o site novo no ar e com as funções comprovante-upload e comprovante-url já publicadas (VITE_JOINERS_AUTH ligado).
--   O site de hoje envia e abre comprovantes direto no Storage e deixaria de funcionar nesses pontos. Depois do C0-B5 e do C0-B6.
-- Tudo em uma transação com registro do estado anterior e verificação antes do COMMIT. Se qualquer guarda falhar: "Nada foi alterado".
begin;

create schema if not exists emergencia;
revoke all on schema emergencia from public, anon, authenticated;
create table if not exists emergencia.c0b_estado_anterior (
  id bigint generated always as identity primary key, registrado_em timestamptz not null default now(), etapa text not null, objeto text not null, detalhe text
);
alter table emergencia.c0b_estado_anterior enable row level security;
revoke all on table emergencia.c0b_estado_anterior from public, anon, authenticated;

do $$
declare n integer; v_expoe text;
begin
  if exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J5') then raise exception 'J5 já foi aplicado. Nada foi alterado.'; end if;
  if to_regprocedure('public.meu_cog()') is null or to_regprocedure('public.is_admin()') is null then raise exception 'J1/A1 não estão aplicados. Nada foi alterado.'; end if;
  if to_regprocedure('public.cog_e_da_conta(text)') is null then raise exception 'O J4a não está aplicado (falta cog_e_da_conta). Nada foi alterado.'; end if;
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then raise exception 'storage.objects/buckets não existem. Nada foi alterado.'; end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then raise exception 'RLS desligado em storage.objects. Nada foi alterado.'; end if;
  select count(*) into n from storage.buckets where id in ('comprovantes', 'mercari-comprovantes');
  if n <> 2 then raise exception 'Esperava os buckets comprovantes e mercari-comprovantes e achei % de 2. Nada foi alterado.', n; end if;
  select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'allow upload' and cmd = 'INSERT' and permissive = 'PERMISSIVE';
  if n <> 1 then raise exception 'A policy "allow upload" (INSERT) não está como esperado. Nada foi alterado.'; end if;
  -- se existir QUALQUER policy de leitura aberta que alcance os buckets de comprovantes, o fechamento seria incompleto
  select string_agg(p.policyname || ' (' || p.cmd || ')', '; ') into v_expoe from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE' and p.cmd in ('SELECT', 'ALL', 'UPDATE', 'DELETE')
     and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
     and (coalesce(p.qual, '') ~* 'comprovantes' or coalesce(p.qual, '') !~* 'bucket_id');
  if v_expoe is not null then raise exception 'Há policy de leitura/alteração aberta que alcança os comprovantes: %. Aplique antes o C0-B5/B6 ou remova-a. Nada foi alterado.', v_expoe; end if;
  if to_regprocedure('public.comprovante_assinavel(text,text)') is not null or to_regclass('public.comprovantes_uploads') is not null then raise exception 'Objetos do J5 já existem. Nada foi alterado.'; end if;
end $$;

-- estado ANTERIOR: policies de storage.objects (para recriar exatamente), configuração dos buckets e quantidade de arquivos
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J5', 'policy ' || policyname,
       json_build_object('tabela', tablename, 'nome', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check, 'permissive', permissive)::text
from pg_policies where schemaname = 'storage' and tablename = 'objects';
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J5', 'bucket ' || id, json_build_object('public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types)::text
from storage.buckets where id in ('comprovantes', 'mercari-comprovantes');
insert into emergencia.c0b_estado_anterior (etapa, objeto, detalhe)
select 'J5', 'arquivos ' || b.id, 'quantidade=' || (select count(*) from storage.objects o where o.bucket_id = b.id) from storage.buckets b where b.id in ('comprovantes', 'mercari-comprovantes');

-- 1) controle de envios e DONOS dos arquivos (só o servidor lê e grava; o navegador nunca escreve aqui)
--    Cada arquivo tem dona (COG da conta ou e-mail verificado): a dos arquivos que JÁ EXISTEM vem de um retrato dos pedidos de hoje (abaixo),
--    e a dos novos é gravada pela função comprovante-upload no momento da autorização. Assim a dona NÃO pode "se declarar dona" de um arquivo de outra pessoa
--    escrevendo o endereço dele no próprio pedido (a URL gravada em pedido é texto livre do navegador e por isso não vale como prova).
create table public.comprovantes_uploads (
  id bigint generated always as identity primary key, chave text not null, bucket text, path text, cog text, email text, origem text not null default 'envio', criado_em timestamptz not null default now()
);
create index comprovantes_uploads_chave_idx on public.comprovantes_uploads (chave, criado_em);
create index comprovantes_uploads_arquivo_idx on public.comprovantes_uploads (bucket, path);   -- um arquivo pode ter mais de uma dona (ex.: repasse: quem repassa e quem recebe)
alter table public.comprovantes_uploads enable row level security;
revoke all on table public.comprovantes_uploads from public, anon, authenticated;

-- retrato dos arquivos que já existem: tabela, coluna da URL, colunas que dizem de quem é (cog:COLUNA ou email:COLUNA)
do $$
declare
  v_fontes text[][] := array[
    ['pagamento_demandas', 'comprovante_url', 'cog:joiner_cog'],
    ['envio_solicitacoes', 'comprovante_url', 'cog:joiner_cog'],
    ['mercari_pedidos', 'comprovante_url', 'cog:joiner_cog'],
    ['repassos', 'comprovacao_url', 'cog:joiner_cog,cog:novo_dono_cog'],
    ['pedidos_revista', 'comprovante_url', 'email:email'], ['pedidos_popup', 'comprovante_url', 'email:email'], ['pedidos_wmag', 'comprovante_url', 'email:email'],
    ['pedidos_wmag_leeknow', 'comprovante_url', 'email:email'], ['pedidos_dazed_seungmin', 'comprovante_url', 'email:email'], ['pedidos_smolmerch', 'comprovante_url', 'email:email'],
    ['pedidos_bazaar_in', 'comprovante_url', 'email:email'], ['pedidos_lightstick', 'comprovante_url', 'cog:joiner_cog'], ['pedidos_popcorn_sleeve', 'comprovante_url', 'cog:joiner_cog'],
    ['pedidos_singba', 'comprovante_url', 'cog:joiner_cog'], ['pedidos_skzoo_rio', 'comprovante_url', 'cog:cog']];
  i integer; p text; partes text[]; v_col_cog text; v_col_email text; v_tab text; v_col text;
  v_rx text := '/storage/v1/object/(?:public|sign|authenticated)/(comprovantes|mercari-comprovantes)/([^?#]+)';
begin
  for i in 1 .. array_length(v_fontes, 1) loop
    v_tab := v_fontes[i][1]; v_col := v_fontes[i][2];
    if to_regclass('public.' || v_tab) is null then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tab and column_name = v_col) then continue; end if;
    foreach p in array string_to_array(v_fontes[i][3], ',') loop
      v_col_cog := null; v_col_email := null;
      if split_part(p, ':', 1) = 'cog' then v_col_cog := split_part(p, ':', 2); else v_col_email := split_part(p, ':', 2); end if;
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tab and column_name = coalesce(v_col_cog, v_col_email)) then continue; end if;
      execute format($f$
        insert into public.comprovantes_uploads (chave, bucket, path, cog, email, origem)
        select 'legado', m[1], replace(m[2], '%%20', ' '), %s, %s, 'legado'
          from (select %I as u, %s as dono from public.%I where %I is not null) t,
               lateral (select regexp_match(t.u, %L)) x(m)
         where m is not null and t.dono is not null and t.dono <> ''
           and not exists (select 1 from public.comprovantes_uploads c where c.bucket = m[1] and c.path = replace(m[2], '%%20', ' ') and c.cog is not distinct from %s and c.email is not distinct from %s)$f$,
        case when v_col_cog is not null then 't.dono' else 'null' end,
        case when v_col_email is not null then 'lower(trim(t.dono))' else 'null' end,
        v_col, coalesce(quote_ident(v_col_cog), quote_ident(v_col_email)), v_tab, v_col, v_rx,
        case when v_col_cog is not null then 't.dono' else 'null' end,
        case when v_col_email is not null then 'lower(trim(t.dono))' else 'null' end);
    end loop;
  end loop;
end $$;

-- 2) quem pode VER um arquivo: a administradora, ou a dona registrada (COG da conta ou e-mail verificado)
create function public.comprovante_assinavel(p_bucket text, p_path text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
begin
  if p_bucket is null or p_path is null or length(p_path) > 300 then return false; end if;
  if (select public.is_admin()) then return true; end if;
  if (select public.meu_cog()) is null then return false; end if;
  return exists (select 1 from public.comprovantes_uploads u
                  where u.bucket = p_bucket and u.path = p_path
                    and ((u.cog is not null and public.cog_e_da_conta(u.cog)) or (u.email is not null and v_email <> '' and u.email = v_email)));
end $$;
revoke all on function public.comprovante_assinavel(text, text) from public, anon;
grant execute on function public.comprovante_assinavel(text, text) to authenticated, service_role;

-- 3) buckets privados, só imagem e PDF, até 10 MB
update storage.buckets set public = false, file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
 where id in ('comprovantes', 'mercari-comprovantes');

-- 4) o envio direto sai: as policies de INSERT específicas dos comprovantes caem e a "allow upload" passa a valer só para conta LOGADA e fora dos buckets de comprovantes
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('anon upload comprovante', 'comprovantes upload', 'joiner upload comprovante') loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;
alter policy "allow upload" on storage.objects to authenticated
  with check (bucket_id not in ('anti-store', 'comprovantes', 'mercari-comprovantes') and ((select public.meu_cog()) is not null or (select public.is_admin())));

-- 5) conferência dentro da transação: qualquer falha desfaz tudo
do $$
declare n integer; v_expoe text; antes integer; depois integer; v_a text; v_d text; b text;
begin
  if exists (select 1 from storage.buckets where id in ('comprovantes', 'mercari-comprovantes') and (public or file_size_limit is distinct from 10485760 or allowed_mime_types is null)) then raise exception 'Os buckets de comprovantes não ficaram privados com limites. Transação desfeita.'; end if;
  -- ninguém (visitante ou conta logada) escreve nos buckets de comprovantes por policy
  select string_agg(p.policyname || ' (' || p.cmd || ')', '; ') into v_expoe from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects' and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and exists (select 1 from unnest(p.roles) r where case when r = 'public' then true else pg_has_role('anon', r, 'member') or pg_has_role('authenticated', r, 'member') end)
     and not (coalesce(p.with_check, '') || ' ' || coalesce(p.qual, '') ~* 'bucket_id\s*=\s*''(avatars|fotos-itens|storage-itens)'''
              or (coalesce(p.with_check, '') ilike '%''comprovantes''%' and coalesce(p.with_check, '') ilike '%''mercari-comprovantes''%' and coalesce(p.with_check, '') ilike '%''anti-store''%' and coalesce(p.with_check, '') ~* '(<>|not)'));
  if v_expoe is not null then raise exception 'Ainda há policy de escrita que alcança os comprovantes: %. Transação desfeita.', v_expoe; end if;
  -- visitante não escreve em nenhum bucket
  select count(*) into n from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects' and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL') and 'anon' = any(p.roles);
  if n > 0 then raise exception 'Sobrou policy de escrita para o visitante no Storage (%). Transação desfeita.', n; end if;
  if not exists (select 1 from pg_proc p where p.oid = 'public.comprovante_assinavel(text,text)'::regprocedure and p.prosecdef and p.proconfig = array['search_path=""']) or has_function_privilege('anon', 'public.comprovante_assinavel(text,text)', 'EXECUTE') then raise exception 'comprovante_assinavel sem security definer/search_path vazio ou aberta ao visitante. Transação desfeita.'; end if;
  if has_table_privilege('anon', 'public.comprovantes_uploads', 'SELECT') or has_table_privilege('authenticated', 'public.comprovantes_uploads', 'SELECT') then raise exception 'A tabela de controle de envios está aberta. Transação desfeita.'; end if;
  -- só as policies esperadas saíram (3 de INSERT dos comprovantes, se existiam)
  select count(*) into antes from emergencia.c0b_estado_anterior where etapa = 'J5' and objeto like 'policy %';
  select count(*) into depois from pg_policies where schemaname = 'storage' and tablename = 'objects';
  if depois > antes or depois < antes - 3 then raise exception 'Quantidade inesperada de policies em storage.objects (% antes, % agora). Transação desfeita.', antes, depois; end if;
  -- nenhum arquivo foi tocado
  for b in select unnest(array['comprovantes', 'mercari-comprovantes']) loop
    select detalhe into v_a from emergencia.c0b_estado_anterior where etapa = 'J5' and objeto = 'arquivos ' || b;
    select 'quantidade=' || count(*) into v_d from storage.objects where bucket_id = b;
    if v_a is distinct from v_d then raise exception 'A quantidade de arquivos de % mudou durante o script. Transação desfeita.', b; end if;
  end loop;
end $$;

commit;
