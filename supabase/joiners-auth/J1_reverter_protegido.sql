-- J1 (v2) — REVERSÃO PROTEGIDA: remove as tabelas e funções de contas das joiners.
-- Se já houver contas vinculadas, a reversão é RECUSADA (apagaria os vínculos). Para apagar mesmo assim, use a frase mais longa.
-- Nada reverte sozinho. Digite, na variável abaixo, a frase exata de autorização. A tabela joiners nunca é tocada.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REMOVER ESTRUTURA DE CONTAS
                            --    (com vínculos existentes:  AUTORIZO REMOVER ESTRUTURA DE CONTAS E VINCULOS)
  n integer := 0;
begin
  if confirmacao not in ('AUTORIZO REMOVER ESTRUTURA DE CONTAS', 'AUTORIZO REMOVER ESTRUTURA DE CONTAS E VINCULOS') then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'J1') then
    raise exception 'Não há registro do J1.';
  end if;
  if to_regclass('public.contas_joiner') is not null then select count(*) into n from public.contas_joiner; end if;
  if n > 0 and confirmacao <> 'AUTORIZO REMOVER ESTRUTURA DE CONTAS E VINCULOS' then
    raise exception 'Existem % contas vinculadas; remover a estrutura apagaria esses vínculos. Use a frase com "E VINCULOS" se for isso mesmo.', n;
  end if;
end $$;

drop function if exists public.admin_desvincular_conta(uuid);
drop function if exists public.admin_resolver_vinculo(bigint, boolean, bigint);
drop function if exists public.admin_buscar_joiners(text);
drop function if exists public.admin_vinculos_pendentes();
drop function if exists public.meu_joiner_id();
drop function if exists public.meu_cog();
drop function if exists public.ativar_minha_conta(text);
drop table if exists public.vinculos_pendentes;
drop table if exists public.contas_joiner;

update emergencia.c0b_estado_anterior set etapa = 'J1-revertido' where etapa = 'J1';

do $$ begin raise notice 'Reversão do J1 feita: estrutura de contas removida (joiners não foi tocada).'; end $$;

commit;
