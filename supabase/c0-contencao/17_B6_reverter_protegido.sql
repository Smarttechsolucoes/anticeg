-- C0-B6 — REVERSÃO PROTEGIDA (NÃO USE sem decisão consciente: ela REABRE o anti-store para qualquer pessoa, inclusive apagar e alterar)
-- Nada reverte sozinho. Para executar é preciso digitar, na variável abaixo, a frase exata de autorização.
-- Recria exatamente as 5 policies removidas e devolve "allow upload" ao with check (true).
begin;

do $$
declare
  confirmacao text := '';   -- << digite exatamente:  AUTORIZO REABRIR ANTI-STORE
begin
  if confirmacao is distinct from 'AUTORIZO REABRIR ANTI-STORE' then
    raise exception 'Reversão NÃO executada: falta a confirmação por escrito. Isto permitiria que qualquer pessoa leia, envie, altere e apague arquivos do anti-store.';
  end if;
  if not exists (select 1 from emergencia.c0b_estado_anterior where etapa = 'B6') then
    raise exception 'Não há estado anterior do B6 registrado.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and policyname in ('allow-anon pt8eye_0', 'allow-anon pt8eye_1', 'allow-anon pt8eye_2', 'allow-anon pt8eye_3', 'Public downloads (restricted)')) then
    raise exception 'Alguma policy do anti-store já existe: nada a reverter.';
  end if;
end $$;

create policy "allow-anon pt8eye_0" on storage.objects for insert to anon with check (bucket_id = 'anti-store'::text);
create policy "allow-anon pt8eye_1" on storage.objects for select to anon using (bucket_id = 'anti-store'::text);
create policy "allow-anon pt8eye_2" on storage.objects for update to anon using (bucket_id = 'anti-store'::text);
create policy "allow-anon pt8eye_3" on storage.objects for delete to anon using (bucket_id = 'anti-store'::text);
create policy "Public downloads (restricted)" on storage.objects for select to public
  using ((bucket_id = 'anti-store'::text) and ((storage.foldername(name))[2] = 'some-prefix'::text));
alter policy "allow upload" on storage.objects with check (true);

-- permite refazer o B6 depois (o registro do estado antigo é arquivado, não apagado)
update emergencia.c0b_estado_anterior set etapa = 'B6-revertido' where etapa = 'B6';

do $$ begin raise notice 'Reversão do B6 feita: o bucket anti-store foi REABERTO ao acesso anônimo.'; end $$;

commit;
