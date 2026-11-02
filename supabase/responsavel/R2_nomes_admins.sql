-- R2 — CADASTRAR O NOME DE CADA CONTA DE ADMIN (rode depois de R2_responsavel_aplicar.sql).
-- Troque os e-mails de exemplo pelos reais (mantendo aspas simples). NAO guarde e-mails reais neste arquivo do repositorio (ele e publico).
-- Todos ou nenhum: se algum e-mail nao for de um admin cadastrado, nada e gravado.
begin;
do $$
declare
  v_emails text[] := array['admin1@exemplo.com', 'admin2@exemplo.com', 'admin3@exemplo.com'];
  v_nomes  text[] := array['Nanda', 'Nath', 'Leticia'];
  i integer; v_n integer;
begin
  for i in 1 .. array_length(v_emails, 1) loop
    update public.admin_roles r set nome = v_nomes[i]
     where r.user_id = (select u.id from auth.users u where lower(u.email) = lower(trim(v_emails[i])));
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'O e-mail % nao e de um admin cadastrado em admin_roles. Nada foi gravado.', v_emails[i];
    end if;
  end loop;
end $$;
commit;

-- conferencia: deve listar os 3 nomes
select u.email, r.nome from public.admin_roles r join auth.users u on u.id = r.user_id order by r.nome;
