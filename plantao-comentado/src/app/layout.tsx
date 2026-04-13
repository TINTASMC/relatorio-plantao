/*
  layout.tsx — Layout raiz da aplicação
  
  Este arquivo envolve TODAS as páginas do sistema.
  Qualquer coisa colocada aqui aparece em todas as telas.
  
  O metadata define o título e descrição que aparecem
  na aba do navegador e no Google.
*/
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Relatório de Plantão',
  description: 'Sistema de registro e consulta de relatórios de plantão 08h–13h',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
