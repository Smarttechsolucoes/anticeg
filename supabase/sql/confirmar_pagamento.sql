-- Função para confirmar/reabrir pagamento_demandas via anon key.
-- SECURITY DEFINER contorna o RLS que bloqueia UPDATE via anon key.
-- Rode este script uma única vez no SQL Editor do Supabase.

create or replace function set_pagamento_demanda_status(demanda_id bigint, novo_status text)
returns void
language plpgsql
security definer
as $$
begin
  update pagamento_demandas set status = novo_status where id = demanda_id;
end;
$$;

-- garante que a função pode ser chamada via anon key
grant execute on function set_pagamento_demanda_status(bigint, text) to anon;
