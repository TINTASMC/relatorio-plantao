/*
  app/relatorios/page.tsx — Tela de consulta de relatórios
  
  Esta página lista todos os relatórios salvos no banco,
  com filtros, busca e opção de imprimir.
  
  Funcionalidades:
  - Cards de estatísticas (Total, Normal, Alerta, Crítico)
  - Busca por texto livre (plantonista ou observações)
  - Filtros por status, plantonista e período de datas
  - Ordenação por mais recente ou mais antigo
  - Linhas expansíveis com detalhes completos
  - Impressão individual e exportação da lista
*/
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Relatorio, StatusPlantao } from '@/types';
import {
  Search, Filter, X, RefreshCw, FilePlus, Calendar,
  ChevronDown, ChevronUp, Printer, AlertTriangle, AlertOctagon,
  CheckCircle2, Clock, User, Loader2, ArrowUpDown,
  ClipboardList, FileText,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Componente: StatusBadge ──────────────────────────────────
// Badge colorido que exibe o status do plantão com ícone
// Verde = Normal | Amarelo = Alerta | Vermelho = Crítico
function StatusBadge({ s }: { s: StatusPlantao }) {
  const map = {
    'Normal':  { bg: 'var(--green-bg)',  color: 'var(--green)',  bd: 'var(--green-bd)',  icon: <CheckCircle2 size={10}/> },
    'Alerta':  { bg: 'var(--yellow-bg)', color: 'var(--yellow)', bd: 'var(--yellow-bd)', icon: <AlertTriangle size={10}/> },
    'Crítico': { bg: 'var(--red-bg)',    color: 'var(--red)',    bd: 'var(--red-bd)',    icon: <AlertOctagon size={10}/> },
  };
  const { bg, color, bd, icon } = map[s];
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit"
      style={{ background: bg, color, border: `1px solid ${bd}` }}>
      {icon} {s}
    </span>
  );
}

// ─── Componente: RelatorioRow ─────────────────────────────────
// Uma linha da tabela que expande ao ser clicada
//
// Estado fechado: mostra número, data, plantonista, horário, status
// Estado aberto: mostra ocorrências, observações e botão de impressão
//
// onPrint = função recebida da página pai para gerar a impressão
function RelatorioRow({ r, onPrint }: { r: Relatorio; onPrint: (r: Relatorio) => void }) {
  const [open, setOpen] = useState(false);
  // Conta ocorrências de alta severidade para mostrar badge de alerta
  const ocAlta = r.ocorrencias.filter(o => o.severidade === 'Alta').length;

  return (
    <>
      {/* Linha principal clicável */}
      <div
        className="grid gap-2 px-4 py-3.5 cursor-pointer transition-colors"
        style={{ gridTemplateColumns: '72px 1fr 110px 32px' }}
        onClick={() => setOpen(v => !v)}
        onMouseOver={e => { if (!open) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
        onMouseOut={e => { if (!open) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        {/* Coluna 1: número do relatório em fonte mono (tipo código) */}
        <div className="flex items-center">
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
            #{String(r.numero).padStart(4,'0')}
          </span>
        </div>

        {/* Coluna 2: data por extenso + plantonista + resumo */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/*
              parseISO converte a string "2026-04-07" para um objeto Date
              O 'T12:00:00' evita que o JavaScript mude o dia por causa
              da diferença de fuso horário entre o banco (UTC) e o Brasil
              format(..., ptBR) formata em português: "segunda-feira, 07 de abril"
            */}
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {format(parseISO(r.data + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            {/* Badge vermelho só aparece se tiver ocorrências de alta severidade */}
            {ocAlta > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-bd)' }}>
                {ocAlta} alta{ocAlta > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--muted)' }}>
              <User size={9}/> {r.plantonista}
            </span>
            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--muted2)' }}>
              <Clock size={9}/> 08:00–{r.hora_fim}
            </span>
            {r.ocorrencias.length > 0 && (
              <span className="text-[11px]" style={{ color: 'var(--muted2)' }}>
                {r.ocorrencias.length} ocorrência{r.ocorrencias.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Coluna 3: badge de status */}
        <div className="flex items-center"><StatusBadge s={r.status}/></div>

        {/* Coluna 4: seta indicando aberto/fechado */}
        <div className="flex items-center justify-center" style={{ color: 'var(--muted2)' }}>
          {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </div>
      </div>

      {/* Conteúdo expandido — só renderiza quando open = true */}
      {open && (
        <div className="px-4 pb-5 fade-in"
          style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>

          {/* Seção de ocorrências */}
          <div className="pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted2)' }}>
              Ocorrências ({r.ocorrencias.length})
            </p>
            {r.ocorrencias.length === 0 ? (
              <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--green)' }}>
                <CheckCircle2 size={14}/> Nenhuma ocorrência registrada
              </p>
            ) : (
              <div className="space-y-2">
                {r.ocorrencias.map(oc => (
                  <div key={oc.id} className="rounded-xl p-3.5"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      // Faixa colorida à esquerda: verde=baixa, amarelo=média, vermelho=alta
                      borderLeft: `3px solid ${oc.severidade === 'Alta' ? 'var(--red)' : oc.severidade === 'Média' ? 'var(--yellow)' : 'var(--green)'}`,
                    }}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{oc.titulo}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: oc.severidade === 'Alta' ? 'var(--red-bg)' : oc.severidade === 'Média' ? 'var(--yellow-bg)' : 'var(--green-bg)',
                          color: oc.severidade === 'Alta' ? 'var(--red)' : oc.severidade === 'Média' ? 'var(--yellow)' : 'var(--green)',
                        }}>
                        {oc.severidade}
                      </span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                        <Clock size={9}/> {oc.horario}
                      </span>
                    </div>
                    {/* Descrição só aparece se tiver sido preenchida */}
                    {oc.descricao && (
                      <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--text2)' }}>{oc.descricao}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações — só aparece se preenchidas */}
          {r.observacoes && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)' }}>
                Observações Gerais
              </p>
              {/* pre-wrap preserva as quebras de linha como foram digitadas */}
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
                {r.observacoes}
              </p>
            </div>
          )}

          {/* Botão de impressão individual */}
          <div className="flex justify-end mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => onPrint(r)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ border: '1px solid var(--border2)', color: 'var(--text2)', background: 'transparent' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border2)'}>
              <Printer size={12}/> Imprimir este relatório
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function RelatoriosPage() {
  const router = useRouter();

  // Dados carregados do banco
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);   // true enquanto carrega
  const [total, setTotal] = useState(0);           // total de registros no banco

  // Controle da interface
  const [showFilters, setShowFilters] = useState(false); // painel de filtros aberto?
  const printRef = useRef<Relatorio | null>(null);       // referência para impressão

  // Filtros ativos
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusPlantao | ''>('');
  const [filtroPlantonista, setFiltroPlantonista] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc'); // mais recentes primeiro

  // Conta quantos filtros estão ativos para mostrar no botão
  const activeCount = [filtroStatus, filtroPlantonista, dataInicio, dataFim, busca].filter(Boolean).length;

  /*
    fetchData — busca os relatórios no Supabase aplicando os filtros
    
    useCallback evita que essa função seja recriada toda vez que o componente
    renderizar. Ela só é recriada quando um dos filtros muda.
    
    O Supabase funciona como uma query builder:
    você vai encadeando os filtros (.eq, .ilike, .gte, .lte)
    e só executa quando chama o await
  */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('relatorios').select('*', { count: 'exact' });
      if (filtroStatus)       q = q.eq('status', filtroStatus);           // igual a
      if (filtroPlantonista)  q = q.ilike('plantonista', `%${filtroPlantonista}%`); // contém (case insensitive)
      if (busca)              q = q.or(`plantonista.ilike.%${busca}%,observacoes.ilike.%${busca}%`);
      if (dataInicio)         q = q.gte('data', dataInicio); // maior ou igual
      if (dataFim)            q = q.lte('data', dataFim);   // menor ou igual
      q = q.order('data', { ascending: sortDir === 'asc' }).order('numero', { ascending: sortDir === 'asc' });
      const { data, error, count } = await q;
      if (error) throw error;
      setRelatorios((data || []) as Relatorio[]);
      setTotal(count || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filtroStatus, filtroPlantonista, busca, dataInicio, dataFim, sortDir]);

  // useEffect executa fetchData toda vez que um filtro muda
  // É como um "observador" que fica de olho nas dependências
  useEffect(() => { fetchData(); }, [fetchData]);

  // Limpa todos os filtros de uma vez
  function clearFilters() {
    setBusca(''); setFiltroStatus(''); setFiltroPlantonista('');
    setDataInicio(''); setDataFim('');
  }

  /*
    handlePrint — gera uma página de impressão para um relatório específico
    
    Em vez de imprimir a tela atual (que é escura e tem menu),
    abre uma janela nova com HTML formatado em branco para impressão.
    O setTimeout espera 300ms para garantir que o HTML carregou.
  */
  function handlePrint(r: Relatorio) {
    printRef.current = r;
    const ocHtml = r.ocorrencias.length === 0
      ? '<p>Nenhuma ocorrência registrada neste plantão.</p>'
      : r.ocorrencias.map(oc => `
        <div style="margin-bottom:12px;padding-left:12px;border-left:3px solid #333">
          <p style="font-weight:bold;margin:0 0 2px">${oc.titulo} <span style="font-weight:normal">(${oc.severidade}) — ${oc.horario}</span></p>
          ${oc.descricao ? `<p style="margin:0;color:#444">${oc.descricao}</p>` : ''}
        </div>`).join('');

    const obsHtml = r.observacoes
      ? `<h2 style="font-size:14px;margin:20px 0 8px">Observações Gerais</h2><p style="white-space:pre-wrap;color:#333">${r.observacoes}</p>`
      : '';

    const html = `<!DOCTYPE html><html><head><title>Relatório #${String(r.numero).padStart(4,'0')}</title>
    <style>body{font-family:Arial,sans-serif;color:#000;padding:24px;max-width:700px;margin:0 auto}
    h1{font-size:18px;margin-bottom:4px}h2{font-size:14px}
    table td{padding-bottom:6px}@page{margin:1.5cm}</style></head><body>
    <h1>Relatório de Plantão #${String(r.numero).padStart(4,'0')}</h1>
    <hr style="margin-bottom:16px"/>
    <table><tbody>
      <tr><td style="font-weight:bold;padding-right:16px">Data:</td><td>${r.data.split('-').reverse().join('/')}</td></tr>
      <tr><td style="font-weight:bold;padding-right:16px">Horário:</td><td>08:00 – ${r.hora_fim}</td></tr>
      <tr><td style="font-weight:bold;padding-right:16px">Plantonista:</td><td>${r.plantonista}</td></tr>
      <tr><td style="font-weight:bold;padding-right:16px">Status:</td><td>${r.status}</td></tr>
    </tbody></table>
    <h2 style="margin-top:20px;margin-bottom:8px">Ocorrências (${r.ocorrencias.length})</h2>
    ${ocHtml}${obsHtml}
    <hr style="margin-top:32px"/>
    <p style="font-size:11px;color:#777">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  // handlePrintList — gera uma tabela com todos os resultados filtrados para impressão
  function handlePrintList() {
    const rows = relatorios.map(r => `
      <tr>
        <td>#${String(r.numero).padStart(4,'0')}</td>
        <td>${r.data.split('-').reverse().join('/')}</td>
        <td>${r.plantonista}</td>
        <td>${r.status}</td>
        <td>${r.ocorrencias.length}</td>
        <td>${r.ocorrencias.filter(o=>o.severidade==='Alta').length > 0 ? '⚠ '+r.ocorrencias.filter(o=>o.severidade==='Alta').length+' alta' : '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Lista de Relatórios de Plantão</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
    th{background:#f5f5f5;font-weight:bold}
    @page{margin:1.5cm}</style></head><body>
    <h1>Relatórios de Plantão — 08:00 a 13:00</h1>
    <p style="color:#666;font-size:12px">Exportado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · ${total} registro${total!==1?'s':''}</p>
    <table><thead><tr><th>#</th><th>Data</th><th>Plantonista</th><th>Status</th><th>Ocorrências</th><th>Alta</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  // Calcula os números dos cards de estatísticas a partir dos dados carregados
  const stats = {
    normal:  relatorios.filter(r => r.status === 'Normal').length,
    alerta:  relatorios.filter(r => r.status === 'Alerta').length,
    critico: relatorios.filter(r => r.status === 'Crítico').length,
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header/>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 screen-only">

        {/* Título e botão novo relatório */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Relatórios de Plantão</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {loading ? 'Carregando...' : `${total} relatório${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={() => router.push('/novo-relatorio')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white no-print"
            style={{ background: 'var(--accent)' }}>
            <FilePlus size={15}/> <span className="hidden sm:inline">Novo Relatório</span>
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',    val: total,         color: 'var(--accent3)', icon: <ClipboardList size={14}/> },
            { label: 'Normal',   val: stats.normal,  color: 'var(--green)',   icon: <CheckCircle2 size={14}/> },
            { label: 'Alerta',   val: stats.alerta,  color: 'var(--yellow)',  icon: <AlertTriangle size={14}/> },
            { label: 'Crítico',  val: stats.critico, color: 'var(--red)',     icon: <AlertOctagon size={14}/> },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5 mb-1.5" style={{ color: s.color }}>
                {s.icon}
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.label}</span>
              </div>
              <p className="text-3xl font-black" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Barra de busca e controles */}
        <div className="space-y-3">
          <div className="flex gap-2">
            {/* Campo de busca livre */}
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted2)' }}/>
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por plantonista ou observações..."
                className="pl-9 pr-4 py-2.5 text-sm rounded-xl"
                style={{ background: 'var(--surface)', border: '1.5px solid var(--border2)' }}/>
              {/* X para limpar — só aparece quando há texto digitado */}
              {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted2)' }}><X size={13}/></button>}
            </div>

            {/* Botão de filtros — fica roxo quando há filtros ativos */}
            <button onClick={() => setShowFilters(v => !v)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all"
              style={{
                background: activeCount > 0 ? 'rgba(99,102,241,0.1)' : 'var(--surface)',
                borderColor: activeCount > 0 ? 'rgba(99,102,241,0.4)' : 'var(--border2)',
                color: activeCount > 0 ? 'var(--accent3)' : 'var(--muted)',
              }}>
              <Filter size={14}/>
              <span className="hidden sm:inline text-sm">Filtros</span>
              {activeCount > 0 && (
                <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: 'var(--accent)', color: '#fff' }}>{activeCount}</span>
              )}
            </button>

            {/* Botão de ordenação — alterna entre recentes e antigos */}
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'desc' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--muted)' }}>
              <ArrowUpDown size={14}/>
              <span className="hidden sm:inline text-xs">{sortDir === 'desc' ? 'Recentes' : 'Antigos'}</span>
            </button>

            {/* Botão atualizar — busca os dados novamente */}
            <button onClick={fetchData}
              className="px-3 py-2.5 rounded-xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--muted)' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
          </div>

          {/* Painel de filtros — só aparece quando showFilters = true */}
          {showFilters && (
            <div className="rounded-2xl p-4 space-y-4 fade-in"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Filtro por status — botões visuais coloridos */}
                <div>
                  <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text2)' }}>Status</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['', 'Normal', 'Alerta', 'Crítico'] as const).map(s => (
                      <button key={s} onClick={() => setFiltroStatus(s as StatusPlantao | '')}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
                        style={{
                          background: filtroStatus === s
                            ? (s === 'Normal' ? 'var(--green-bg)' : s === 'Alerta' ? 'var(--yellow-bg)' : s === 'Crítico' ? 'var(--red-bg)' : 'rgba(99,102,241,0.15)')
                            : 'var(--surface3)',
                          color: filtroStatus === s
                            ? (s === 'Normal' ? 'var(--green)' : s === 'Alerta' ? 'var(--yellow)' : s === 'Crítico' ? 'var(--red)' : 'var(--accent3)')
                            : 'var(--muted)',
                          border: `1px solid ${filtroStatus === s
                            ? (s === 'Normal' ? 'var(--green-bd)' : s === 'Alerta' ? 'var(--yellow-bd)' : s === 'Crítico' ? 'var(--red-bd)' : 'rgba(99,102,241,0.3)')
                            : 'var(--border)'}`,
                        }}>
                        {s || 'Todos'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro por plantonista */}
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                    <User size={11}/> Plantonista
                  </label>
                  <input value={filtroPlantonista} onChange={e => setFiltroPlantonista(e.target.value)}
                    placeholder="Nome do plantonista..."
                    className="px-3 py-2 text-sm rounded-xl"
                    style={{ background: 'var(--surface2)', border: '1.5px solid var(--border2)' }}/>
                </div>
              </div>

              {/* Filtro por período de datas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                    <Calendar size={11}/> De
                  </label>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl"
                    style={{ background: 'var(--surface2)', border: '1.5px solid var(--border2)' }}/>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text2)' }}>
                    <Calendar size={11}/> Até
                  </label>
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl"
                    style={{ background: 'var(--surface2)', border: '1.5px solid var(--border2)' }}/>
                </div>
              </div>

              {/* Botão limpar — só aparece quando há filtros ativos */}
              {activeCount > 0 && (
                <button onClick={clearFilters}
                  className="text-xs flex items-center gap-1.5 transition-colors"
                  style={{ color: 'var(--muted)' }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--muted)'}>
                  <X size={11}/> Limpar todos os filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabela de relatórios */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {/* Cabeçalho da tabela */}
          <div className="grid gap-2 px-4 py-3"
            style={{ gridTemplateColumns: '72px 1fr 110px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>#</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>Data / Plantonista</span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>Status</span>
            <span/>
          </div>

          {/* Três estados possíveis: carregando / sem resultados / lista */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3" style={{ color: 'var(--muted)' }}>
              <Loader2 size={20} className="animate-spin"/>
              <span className="text-sm">Carregando relatórios...</span>
            </div>
          ) : relatorios.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-center px-4">
              <FileText size={32} style={{ color: 'var(--muted2)' }}/>
              <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>Nenhum relatório encontrado</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {activeCount > 0 ? 'Tente ajustar os filtros.' : 'Registre o primeiro relatório de plantão!'}
              </p>
              {activeCount > 0 && (
                <button onClick={clearFilters} className="text-xs underline" style={{ color: 'var(--accent2)' }}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            // Renderiza cada relatório como uma linha expansível
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {relatorios.map(r => <RelatorioRow key={r.id} r={r} onPrint={handlePrint}/>)}
            </div>
          )}

          {/* Rodapé com contagem e botão exportar */}
          {relatorios.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <span className="text-xs" style={{ color: 'var(--muted2)' }}>
                {relatorios.length} de {total} relatórios
              </span>
              <button onClick={handlePrintList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all no-print"
                style={{ border: '1px solid var(--border2)', color: 'var(--text2)' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border2)'}>
                <Printer size={12}/> Exportar lista
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
