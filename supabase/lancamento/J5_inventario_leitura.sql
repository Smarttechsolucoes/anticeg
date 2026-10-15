-- J5 — INVENTÁRIO DOS COMPROVANTES ANTIGOS (mapeamento por dona, arquivos sem dona e referências quebradas). SOMENTE LEITURA em tudo que é do site:
-- usa só TABELAS TEMPORÁRIAS da sua sessão (somem ao fechar a aba) e não altera tabela, arquivo, bucket nem permissão. Rode no SQL Editor da PRODUÇÃO, ANTES do J5, e guarde o resultado.
-- O que ele responde (a sua exigência: preservar TODOS os arquivos e vínculos, sem deixar comprovante antigo público, sem quebrar a visualização legítima):
--   * quantos arquivos existem em cada bucket e QUANTOS têm dona identificada (o J5 grava essa dona no momento da aplicação, a partir dos pedidos de hoje);
--   * quais arquivos NÃO têm dona (só a administradora os vê depois do J5) e quais referências apontam para arquivo que não existe;
--   * arquivos usados por mais de uma pessoa (ex.: repasse: quem repassa e quem recebe);
--   * se há comprovantes citados em tabelas que o mapeamento do J5 NÃO conhece (a lista do que seria preciso acrescentar).
-- PARTE 1: rode TUDO de uma vez (o resultado é a tabela "resumo" no fim). PARTE 2: rode cada consulta separada, se quiser a lista de nomes.

drop table if exists pg_temp.j5_refs;
create temp table j5_refs (tabela text, coluna text, bucket text, path text, cog text, email text);
drop table if exists pg_temp.j5_achados;
create temp table j5_achados (tabela text, coluna text, linhas bigint, conhecida boolean);

do $$
declare
  -- as MESMAS fontes que o J5 usa para registrar as donas: tabela, coluna da URL e quem é a dona (cog:COLUNA ou email:COLUNA)
  v_fontes text[][] := array[
    ['pagamento_demandas', 'comprovante_url', 'cog:joiner_cog'], ['envio_solicitacoes', 'comprovante_url', 'cog:joiner_cog'], ['mercari_pedidos', 'comprovante_url', 'cog:joiner_cog'],
    ['repassos', 'comprovacao_url', 'cog:joiner_cog,cog:novo_dono_cog'],
    ['pedidos_revista', 'comprovante_url', 'email:email'], ['pedidos_popup', 'comprovante_url', 'email:email'], ['pedidos_wmag', 'comprovante_url', 'email:email'],
    ['pedidos_wmag_leeknow', 'comprovante_url', 'email:email'], ['pedidos_dazed_seungmin', 'comprovante_url', 'email:email'], ['pedidos_esquire_hyunjin', 'comprovante_url', 'email:email'], ['pedidos_smolmerch', 'comprovante_url', 'email:email'],
    ['pedidos_bazaar_in', 'comprovante_url', 'email:email'], ['pedidos_lightstick', 'comprovante_url', 'cog:joiner_cog'], ['pedidos_popcorn_sleeve', 'comprovante_url', 'cog:joiner_cog'],
    ['pedidos_singba', 'comprovante_url', 'cog:joiner_cog'], ['pedidos_skzoo_rio', 'comprovante_url', 'cog:cog']];
  v_rx text := '/storage/v1/object/(?:public|sign|authenticated)/(comprovantes|mercari-comprovantes)/([^?#]+)';
  i integer; p text; v_tab text; v_col text; v_cog text; v_email text; r record; v_n bigint;
begin
  -- 1) referências conhecidas (com dona)
  for i in 1 .. array_length(v_fontes, 1) loop
    v_tab := v_fontes[i][1]; v_col := v_fontes[i][2];
    if to_regclass('public.' || v_tab) is null then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tab and column_name = v_col) then continue; end if;
    foreach p in array string_to_array(v_fontes[i][3], ',') loop
      v_cog := null; v_email := null;
      if split_part(p, ':', 1) = 'cog' then v_cog := split_part(p, ':', 2); else v_email := split_part(p, ':', 2); end if;
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_tab and column_name = coalesce(v_cog, v_email)) then continue; end if;
      execute format($f$insert into pg_temp.j5_refs select %L, %L, m[1], replace(m[2], '%%20', ' '), %s, %s
                          from (select %I as u, %I as dono from public.%I where %I is not null) t, lateral (select regexp_match(t.u, %L)) x(m)
                         where m is not null$f$, v_tab, v_col, case when v_cog is not null then 'lower(trim(t.dono))' else 'null' end, case when v_email is not null then 'lower(trim(t.dono))' else 'null' end, v_col, coalesce(v_cog, v_email), v_tab, v_col, v_rx);
    end loop;
  end loop;
  -- 2) descoberta: QUALQUER coluna de texto/json de qualquer tabela do site que cite um bucket de comprovantes
  for r in select c.table_name, c.column_name from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
            where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.data_type in ('text', 'character varying', 'jsonb', 'json') and c.table_name not like 'bkp\_%' loop
    execute format($f$select count(*) from public.%I where %I::text like '%%/storage/v1/object/%%comprovantes/%%'$f$, r.table_name, r.column_name) into v_n;
    if v_n > 0 then
      insert into pg_temp.j5_achados values (r.table_name, r.column_name, v_n, exists (select 1 from generate_subscripts(v_fontes, 1) g where v_fontes[g][1] = r.table_name and v_fontes[g][2] = r.column_name));
    end if;
  end loop;
end $$;

select '1 por bucket' as secao, b.id as item,
       'arquivos no Storage: ' || (select count(*) from storage.objects o where o.bucket_id = b.id)
       || ' | com dona identificada: ' || (select count(*) from storage.objects o where o.bucket_id = b.id and exists (select 1 from pg_temp.j5_refs f where f.bucket = b.id and f.path = o.name))
       || ' | SEM dona (só a administradora verá): ' || (select count(*) from storage.objects o where o.bucket_id = b.id and not exists (select 1 from pg_temp.j5_refs f where f.bucket = b.id and f.path = o.name))
       || ' | referências SEM arquivo: ' || (select count(distinct f.path) from pg_temp.j5_refs f where f.bucket = b.id and not exists (select 1 from storage.objects o where o.bucket_id = b.id and o.name = f.path))
       || ' | bucket ' || case when b.public then 'PÚBLICO' else 'privado' end as valor
  from storage.buckets b where b.id in ('comprovantes', 'mercari-comprovantes')
union all select '2 donas', 'COGs distintos | e-mails distintos | arquivos com mais de uma dona',
       (select count(distinct cog) from pg_temp.j5_refs where cog is not null)::text || ' | ' || (select count(distinct email) from pg_temp.j5_refs where email is not null)::text || ' | '
       || (select count(*) from (select bucket, path from pg_temp.j5_refs group by bucket, path having count(distinct coalesce(cog, email)) > 1) x)::text
union all select '3 referências por tabela', f.tabela || '.' || f.coluna, count(*)::text || ' referência(s)' from pg_temp.j5_refs f group by f.tabela, f.coluna
union all select '4 ALERTA: tabela fora do mapeamento', a.tabela || '.' || a.coluna, a.linhas || ' linha(s) citam comprovante e o J5 NÃO sabe quem é a dona: só a administradora verá esses arquivos até você registrar a dona (veja a PARTE 2)'
  from pg_temp.j5_achados a where not a.conhecida
union all select '4 ALERTA: tabela fora do mapeamento', '(nenhuma)', 'todas as tabelas que citam comprovantes estão no mapeamento' where not exists (select 1 from pg_temp.j5_achados where not conhecida)
order by 1, 2;

-- ═════ PARTE 2 — LISTAS (rode UMA consulta por vez; mostram só nomes de arquivo e COG/e-mail da dona, nenhum conteúdo) ═════
-- 2a) arquivos SEM dona (para decidir se alguém precisa ser registrada como dona; a administradora sempre vê tudo):
-- select o.bucket_id, o.name, o.created_at from storage.objects o where o.bucket_id in ('comprovantes', 'mercari-comprovantes') and not exists (select 1 from pg_temp.j5_refs f where f.bucket = o.bucket_id and f.path = o.name) order by o.created_at desc limit 500;
-- 2b) referências cujo arquivo NÃO existe (o vínculo histórico fica guardado; não há o que assinar):
-- select f.tabela, f.coluna, f.bucket, f.path, coalesce(f.cog, f.email) as dona from pg_temp.j5_refs f where not exists (select 1 from storage.objects o where o.bucket_id = f.bucket and o.name = f.path) order by 1, 4 limit 500;
-- 2c) quantos arquivos por dona (para achar casos estranhos, como uma só pessoa com centenas):
-- select coalesce(cog, email) as dona, count(distinct (bucket, path)) as arquivos from pg_temp.j5_refs group by 1 order by 2 desc limit 50;
-- 2d) TODOS os caminhos dos arquivos (exporte em CSV para o script que confirma que os links públicos antigos deixaram de funcionar: scripts/lancamento/verificar-comprovantes-antigos.mjs):
-- select bucket_id, name from storage.objects where bucket_id in ('comprovantes', 'mercari-comprovantes') order by created_at;
-- 2e) registrar uma dona que o mapeamento não conhece (SOMENTE depois do J5 aplicado; troque os valores):
-- insert into public.comprovantes_uploads (chave, bucket, path, cog, origem) values ('manual', 'comprovantes', 'caminho/do/arquivo.jpg', 'cog_da_dona', 'legado');
