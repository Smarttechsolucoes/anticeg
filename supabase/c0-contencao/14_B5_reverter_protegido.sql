-- C0-B5 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE a listagem pública dos comprovantes)
-- Use APENAS se os envios de comprovante pararem de funcionar depois do B5 (por exemplo, se o Storage exigir SELECT no upload).
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR LISTAGEM
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR LISTAGEM' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto permitiria que qualquer pessoa liste todos os comprovantes.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B5') then
    raise exception 'Não há estado anterior do B5 registrado.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'comprovantes read') then
    raise exception 'A policy "comprovantes read" já existe: nada a reverter.';
  end if;
end $$;

create policy "comprovantes read" on storage.objects for select to public using (bucket_id = 'comprovantes'::text);

-- permite refazer o B5 depois (o registro do estado antigo é arquivado, não apagado)
update emergencia.c0b_estado_anterior set etapa = 'B5-revertido' where etapa = 'B5';

do $$ begin raise notice 'Reversão do B5 feita: a listagem pública do bucket comprovantes foi REABERTA.'; end $$;

commit;
