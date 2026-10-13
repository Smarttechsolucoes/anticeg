-- C0-B3 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE a vulnerabilidade)
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
-- Restaura SOMENTE o que estava registrado em emergencia.c0b_estado_anterior (etapa B3): a policy de INSERT e os privilégios de escrita.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR MULTAS
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR MULTAS' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto permitiria que qualquer pessoa crie, altere ou apague multas.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B3') then
    raise exception 'Não há estado anterior do B3 registrado.';
  end if;
end $$;

grant insert, update, delete on table public.multas_pagas to anon, authenticated;
drop policy if exists "multas_pagas_insert_all" on public.multas_pagas;
create policy "multas_pagas_insert_all" on public.multas_pagas for insert with check (true);

-- permite refazer o B3 depois (o registro do estado antigo é arquivado, não apagado)
update emergencia.c0b_estado_anterior set etapa = 'B3-revertido' where etapa = 'B3';

do $$ begin raise notice 'Reversão do B3 feita: a escrita anônima em multas_pagas foi REABERTA.'; end $$;

commit;
