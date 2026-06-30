-- Sistema de badges — histórico de multas pagas (badge "jiniret")
-- Rode este script uma única vez no SQL Editor do Supabase.
--
-- pago_item / pago_frete / pago_rf da masterlist são atualizados fora deste
-- app (sync externo), então a única forma confiável de saber quando uma
-- multa foi paga é um trigger no banco, que dispara independente de quem
-- fez o update.

create table if not exists multas_pagas (
  id bigint generated always as identity primary key,
  joiner_cog text not null,
  masterlist_id bigint not null,
  campo text not null, -- 'item' | 'frete' | 'rf'
  dias_atraso int not null,
  valor_multa numeric not null,
  created_at timestamptz default now()
);

create index if not exists multas_pagas_joiner_cog_idx on multas_pagas (joiner_cog);

create or replace function registrar_multa_paga() returns trigger as $$
begin
  -- item
  if (old.pago_item is distinct from true) and (new.pago_item = true)
     and new.venc_item is not null and new.venc_item < current_date
     and coalesce(new.valor_item, 0) > 0 then
    insert into multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa)
    values (new.cog, new.id, 'item', (current_date - new.venc_item), (current_date - new.venc_item) * 1);
  end if;

  -- frete
  if (old.pago_frete is distinct from true) and (new.pago_frete = true)
     and new.venc_frete is not null and new.venc_frete < current_date
     and coalesce(new.frete_inter, 0) > 0 then
    insert into multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa)
    values (new.cog, new.id, 'frete', (current_date - new.venc_frete), (current_date - new.venc_frete) * 1);
  end if;

  -- taxa RF
  if (old.pago_rf is distinct from true) and (new.pago_rf = true)
     and new.venc_rf is not null and new.venc_rf < current_date
     and coalesce(new.taxa_rf, 0) > 0 then
    insert into multas_pagas (joiner_cog, masterlist_id, campo, dias_atraso, valor_multa)
    values (new.cog, new.id, 'rf', (current_date - new.venc_rf), (current_date - new.venc_rf) * 1);
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_registrar_multa_paga on masterlist;
create trigger trg_registrar_multa_paga
  after update on masterlist
  for each row
  execute function registrar_multa_paga();

-- RLS: leitura liberada (o app lê via anon key) e insert liberado (o trigger
-- roda com o mesmo papel de quem faz o UPDATE na masterlist, hoje sem RLS restritiva)
alter table multas_pagas enable row level security;
drop policy if exists "multas_pagas_select_all" on multas_pagas;
create policy "multas_pagas_select_all" on multas_pagas for select using (true);
drop policy if exists "multas_pagas_insert_all" on multas_pagas;
create policy "multas_pagas_insert_all" on multas_pagas for insert with check (true);
