/*
  page.tsx — Página inicial (/)
  
  Quando alguém acessa o site sem digitar nada depois do domínio,
  esta página redireciona automaticamente para /novo-relatorio.
  
  Ou seja: relatorio-plantao.vercel.app → relatorio-plantao.vercel.app/novo-relatorio
*/
import { redirect } from 'next/navigation';
export default function Home() { redirect('/novo-relatorio'); }
