// Interruptor da etapa 1 do cadastro (lado da joiner). Desligado por padrão: ligar (VITE_CADASTRO_ETAPA1=1) SÓ depois de o SQL E1 estar aplicado e validado em produção.
export const CADASTRO_ETAPA1 = import.meta.env.VITE_CADASTRO_ETAPA1 === "1";
