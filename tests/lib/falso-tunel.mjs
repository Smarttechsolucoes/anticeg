// Faz o papel do cloudflared nos testes: imprime um endereço de túnel falso e fica vivo até ser encerrado. Grava o pid para o teste conferir que foi desligado.
import { writeFileSync } from "node:fs";
if (process.env.E1_FAKE_PID_FILE) writeFileSync(process.env.E1_FAKE_PID_FILE, String(process.pid));
console.error("INF Your quick Tunnel has been created! https://fake-ensaio.trycloudflare.com");
setInterval(() => {}, 1000);
