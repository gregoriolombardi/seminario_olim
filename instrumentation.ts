export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // O Apps Script responde com um redirect para script.googleusercontent.com. Em redes
    // com IPv6 lento, o fetch acabava indo por famílias diferentes em cada salto e o 2º
    // voltava 404 (além de levar 10s+). Com IPv4 primeiro: 200 em ~2s.
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");

    const { aquecer } = await import("@/lib/apps-script");
    aquecer();
  }
}
