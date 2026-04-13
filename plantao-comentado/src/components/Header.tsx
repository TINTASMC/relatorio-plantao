/*
  components/Header.tsx — Barra de navegação do sistema
  
  Este componente aparece no topo de todas as páginas.
  Ele contém o logo, o nome do sistema e os links de navegação.
  
  'use client' significa que este componente roda no navegador,
  não no servidor. É necessário porque usa o hook usePathname,
  que precisa saber qual página está aberta para destacar o link certo.
*/
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FilePlus, ClipboardList, Shield, CalendarDays } from 'lucide-react';

export default function Header() {
  // usePathname retorna o caminho atual da URL
  // Ex: se estiver em /relatorios, path = '/relatorios'
  const path = usePathname();

  // Variáveis booleanas que indicam em qual página o usuário está
  // Usadas para destacar o link ativo no menu
  const isNovo  = path === '/novo-relatorio';
  const isLista = path === '/relatorios' || path.startsWith('/relatorios/');
  const isEscala = path === '/escala';

  return (
    // no-print → esconde o header quando o usuário manda imprimir
    // sticky top-0 → o header fica fixo no topo ao rolar a página
    <header className="no-print sticky top-0 z-50"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo e nome do sistema */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quadrado roxo com ícone de escudo */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)' }}>
            <Shield size={15} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Plantão</p>
            {/* Subtítulo abaixo do nome — nome da equipe */}
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>TIME DE SUPORTE T.I</p>
          </div>
        </div>

        {/* Links de navegação */}
        <nav className="flex items-center gap-1">

          {/* Link: Novo Relatório */}
          <Link href="/novo-relatorio"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              // Se estiver nessa página, fundo roxo claro. Senão, transparente
              background: isNovo ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: isNovo ? 'var(--accent3)' : 'var(--muted)',
            }}>
            <FilePlus size={15} />
            {/* hidden sm:inline = esconde o texto em telas pequenas, mostra em telas médias+ */}
            <span className="hidden sm:inline font-medium">Novo Relatório</span>
          </Link>

          {/* Link: Consultar */}
          <Link href="/relatorios"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              background: isLista ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: isLista ? 'var(--accent3)' : 'var(--muted)',
            }}>
            <ClipboardList size={15} />
            <span className="hidden sm:inline font-medium">Consultar</span>
          </Link>

          {/* Link: Escala */}
          <Link href="/escala"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
            style={{
              background: isEscala ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: isEscala ? 'var(--accent3)' : 'var(--muted)',
            }}>
            <CalendarDays size={15} />
            <span className="hidden sm:inline font-medium">Escala</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
