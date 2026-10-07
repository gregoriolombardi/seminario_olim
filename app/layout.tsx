import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const titulo = "Workshops · II Seminário Internacional de Educação — Olim";
const descricao =
  "Escolha seu workshop no II Seminário Internacional de Educação Olim. 07 de novembro · Auditório do CEJAS · Jaraguá do Sul (SC).";

export const metadata: Metadata = {
  title: titulo,
  description: descricao,
  openGraph: {
    title: titulo,
    description: descricao,
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
