-- ============================================================================
-- E0 — REVERSÃO SELETIVA  (restaura o estado ORIGINAL salvo em emergencia.grant_backup)
-- ============================================================================
-- ATENÇÃO: o estado original era INSEGURO. Reverter E0 REABRE exposições:
--   * reabrir_backups : volta a permitir que anon/authenticated acessem as 31
--                       tabelas bkp_unir_* (cópias de cadastros, com dados pessoais);
--   * reabrir_delete  : volta a permitir DELETE por anon em tabelas onde o site
--                       nunca apaga;
--   * reabrir_outros  : volta TRUNCATE/REFERENCES/TRIGGER/MAINTAIN para anon/authenticated.
--
-- Por isso NADA é revertido por padrão: o script recusa rodar até você marcar,
-- conscientemente, o que quer reabrir (troque false por true nas 3 linhas abaixo).
-- Reabra somente o mínimo que causou um problema comprovado.
-- Cada categoria é independente; reverter uma NÃO reverte as outras.
-- ============================================================================

begin;

do $$
declare
  reabrir_backups boolean := false;   -- << troque para true somente se necessário
  reabrir_delete  boolean := false;   -- << idem
  reabrir_outros  boolean := false;   -- << idem
  -- Confirmação explícita por escrito: copie EXATAMENTE a frase abaixo entre as aspas para autorizar.
  --   AUTORIZO REABRIR EXPOSICOES
  confirmacao     text    := '';

  r         record;
  categoria text;
  ids       bigint[] := '{}';
  n         integer := 0;
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR EXPOSICOES' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito (variável "confirmacao"). Isto reabriria exposições de dados.';
  end if;
  if not (reabrir_backups or reabrir_delete or reabrir_outros) then
    raise exception 'Nada será revertido: marque true em pelo menos uma das 3 opções no início do script (isso reabre uma exposição).';
  end if;
  if not exists (select 1 from emergencia.grant_backup where etapa = 'E0') then
    raise exception 'Não há backup pendente da etapa E0 (já revertida ou nunca aplicada).';
  end if;

  for r in select * from emergencia.grant_backup where etapa = 'E0' order by id loop
    categoria := case
      when r.tabela like 'bkp\_unir\_%' escape '\'                                  then 'backups'
      when r.privilege_type = 'DELETE'                                              then 'delete'
      when r.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')   then 'outros'
      else null                         -- SELECT/INSERT/UPDATE de tabelas comuns: E0 não alterou
    end;

    if categoria is null then continue; end if;
    if (categoria = 'backups' and not reabrir_backups)
       or (categoria = 'delete' and not reabrir_delete)
       or (categoria = 'outros' and not reabrir_outros) then
      continue;
    end if;

    if to_regclass(format('public.%I', r.tabela)) is not null then
      if r.coluna is null then
        execute format('grant %s on table public.%I to %s',
                       r.privilege_type, r.tabela,
                       case when r.grantee = 'PUBLIC' then 'PUBLIC' else quote_ident(r.grantee) end);
      else
        execute format('grant %s (%I) on table public.%I to %s',
                       r.privilege_type, r.coluna, r.tabela,
                       case when r.grantee = 'PUBLIC' then 'PUBLIC' else quote_ident(r.grantee) end);
      end if;
      n := n + 1;
    end if;
    ids := ids || r.id;
  end loop;

  -- marca somente o que foi restaurado; o resto continua "E0" (ainda aplicado)
  update emergencia.grant_backup
     set etapa = 'E0_revertida_' || to_char(now(), 'YYYYMMDDHH24MISS')
   where id = any (ids);

  -- se não resta nenhuma concessão que E0 tenha alterado, encerra a etapa por completo
  -- (as linhas de SELECT/INSERT/UPDATE de tabelas comuns nunca foram alteradas por E0)
  if not exists (
    select 1 from emergencia.grant_backup g
    where g.etapa = 'E0'
      and (g.tabela like 'bkp\_unir\_%' escape '\'
           or g.privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'))
  ) then
    update emergencia.grant_backup
       set etapa = 'E0_revertida_' || to_char(now(), 'YYYYMMDDHH24MISS')
     where etapa = 'E0';
  end if;

  raise notice 'E0 revertida parcialmente: % concessões restauradas (backups=%, delete=%, outros=%).',
               n, reabrir_backups, reabrir_delete, reabrir_outros;
end $$;

commit;
