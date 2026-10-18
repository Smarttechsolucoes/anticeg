// Colunas de joiners que o VISITANTE pode ler (JOINERS1): tudo menos CPF e endereço (cpf, cep, rua, numero, complemento, bairro, cidade, estado, nome_entrega).
// select("*") deixou de funcionar para o visitante de propósito: use SEMPRE esta lista. Deve ser igual à lista "grant select (...)" de supabase/envio/JOINERS1_aplicar.sql (há teste).
export const COLUNAS_JOINER_PUBLICAS = "id,cog,nome,email,twitter,whatsapp,foto_perfil,last_seen,bloqueado,confirmado,last_notified_at,saldo_cashback,nome_site,telefone,recrutador";
