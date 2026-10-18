-- DADOS ISOLADOS DE TESTE para o fluxo por link em PRODUCAO (depois do ENV1/JOINERS1). Nenhum dado de joiner real é tocado.
-- Cria UMA joiner sintética (zz_teste_envio), um item de storage de teste e um token de 1 dia; devolve o token UMA vez. Limpeza: TESTE_ISOLADO_limpar.sql.
-- A joiner de teste não tem e-mail/WhatsApp reais, não gera cobrança, e nenhuma notificação é enviada (o teste de navegador bloqueia funções e Apps Script).
begin;
do $$ begin
  if to_regprocedure('emergencia.gerar_acesso_envio(text,integer,text)') is null then raise exception 'aplique o ENV1 antes'; end if;
  if exists (select 1 from public.joiners where cog = 'zz_teste_envio') then raise exception 'a joiner de teste ja existe: rode a limpeza antes'; end if;
end $$;
insert into public.joiners (cog, nome, email, twitter, whatsapp, confirmado) values ('zz_teste_envio', 'Teste Envio (apagar)', 'teste-envio@exemplo.com', '@zz_teste_envio', null, false);
insert into public.joiner_storage (joiner_cog, foto_url, descricao, ativo) values ('zz_teste_envio', 'https://exemplo.com/teste.png', 'ITEM DE TESTE (apagar)', true);
select emergencia.gerar_acesso_envio('zz_teste_envio', 1, 'teste isolado') as token;
commit;
