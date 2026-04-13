/*
  app/escala/page.tsx — Tela de escala de home office
  
  Exibe quem vai de home office em cada quarta e sexta,
  e quem tem plantão nos sábados, de abril a dezembro de 2026.
  
  Regras aplicadas:
  1. A cada semana, dois vão de home na quarta e dois na sexta
  2. As duplas alternam semana sim, semana não
  3. Quem tem plantão no sábado não vai de home na sexta — vai na quarta
  4. A ordem de plantão nos sábados é: Higor → Danilo → Adriano → Carlos
     (reinicia a cada mês, baseado na posição do sábado no mês)
*/
'use client';
import { useState } from 'react';
import Header from '@/components/Header';

// Nomes dos meses em português para exibir na tela
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Ordem de quem faz plantão no sábado
// 1º sábado do mês = Higor, 2º = Danilo, 3º = Adriano, 4º = Carlos
// Se tiver 5º sábado, o % 4 faz voltar ao início (Higor)
const PLANTAO_ORDEM = ['Higor','Danilo','Adriano','Carlos'];

// Mapeamento de nome para apelido de cor
// Usado para buscar a cor certa no TAG_COLORS
const COR: Record<string, string> = { Higor:'higor', Adriano:'adriano', Carlos:'carlos', Danilo:'danilo' };

// Lista de meses que a escala cobre: abril (3) a dezembro (11) de 2026
// Em JavaScript: janeiro=0, fevereiro=1, março=2, abril=3...
const ALL_MONTHS = Array.from({ length: 9 }, (_, i) => ({ year: 2026, month: i + 3 }));

// addDays — soma N dias a uma data e retorna uma nova data
// Ex: addDays(segunda-feira, 2) → quarta-feira
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }

// fmt — formata uma data para DD/MM
// Ex: new Date(2026, 3, 7) → "07/04"
function fmt(d: Date) { return d.getDate().toString().padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }

// getMonday — a partir de qualquer dia, encontra a segunda-feira da mesma semana
// Isso garante que sempre calculamos a semana a partir da segunda
function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=domingo, 1=segunda... 6=sábado
  d.setDate(d.getDate() + (day===0 ? -6 : 1-day));
  return d;
}

// getSaturdays — retorna todos os sábados de um mês/ano específico
// Ex: abril 2026 → [04/04, 11/04, 18/04, 25/04]
function getSaturdays(year: number, month: number) {
  const sats: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth()===month) {
    if (d.getDay()===6) sats.push(new Date(d)); // getDay()===6 significa sábado
    d.setDate(d.getDate()+1);
  }
  return sats;
}

// getPlantaoSabado — descobre quem tem plantão em um sábado específico
// Encontra a posição do sábado no mês (1º, 2º, 3º...) e retorna o responsável
// Retorna null se a data não for um sábado
function getPlantaoSabado(date: Date) {
  const sats = getSaturdays(date.getFullYear(), date.getMonth());
  const idx = sats.findIndex(s => s.toDateString()===date.toDateString());
  if (idx===-1) return null;
  return PLANTAO_ORDEM[idx % 4]; // % 4 garante que volta ao início após Carlos
}

// Ponto de referência para calcular semanas pares e ímpares
// A partir desta data, contamos as semanas para saber se é par ou ímpar
const REF_MONDAY = new Date(2025, 0, 6);

// getWeekNum — calcula quantas semanas se passaram desde a data de referência
// Resultado par → uma dupla vai de home | Resultado ímpar → outra dupla vai
function getWeekNum(monday: Date) {
  return Math.floor((monday.getTime() - REF_MONDAY.getTime()) / (7*24*60*60*1000));
}

// getHomeOffice — define quem vai de home em cada dia da semana
// Semana PAR:  Carlos+Higor na quarta | Danilo+Adriano na sexta
// Semana ÍMPAR: Danilo+Adriano na quarta | Carlos+Higor na sexta
// q1, q2 = quem vai na quarta | s1, s2 = quem vai na sexta
function getHomeOffice(weekNum: number) {
  return weekNum % 2 === 0
    ? { q1:'Carlos', q2:'Higor', s1:'Danilo', s2:'Adriano' }
    : { q1:'Danilo', q2:'Adriano', s1:'Carlos', s2:'Higor' };
}

// getWeeksForMonth — retorna todas as semanas que têm dias naquele mês
// Para cada semana calcula quarta, sexta e sábado
// Só inclui se a quarta OU a sexta cair dentro do mês correto
function getWeeksForMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const weeks = [];
  let mon = getMonday(firstDay);
  while (mon <= lastDay) {
    const quarta = addDays(mon, 2); // segunda + 2 dias = quarta
    const sexta  = addDays(mon, 4); // segunda + 4 dias = sexta
    const sabado = addDays(mon, 5); // segunda + 5 dias = sábado
    if (quarta.getMonth()===month || sexta.getMonth()===month) {
      weeks.push({ mon: new Date(mon), quarta, sexta, sabado });
    }
    mon = addDays(mon, 7); // avança para a próxima segunda-feira
  }
  return weeks;
}

// TAG_COLORS — cores de fundo e texto para cada tipo de badge
// home-* = cores dos badges de home office de cada pessoa
// plantao-* = cores dos badges de plantão no sábado
// presencial = cinza para quem não vai de home naquele dia
const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'home-higor':    { bg: '#E6F1FB', color: '#185FA5' }, // azul
  'home-adriano':  { bg: '#EAF3DE', color: '#3B6D11' }, // verde
  'home-carlos':   { bg: '#FAEEDA', color: '#854F0B' }, // laranja
  'home-danilo':   { bg: '#FBEAF0', color: '#993556' }, // rosa
  'plantao-higor':   { bg: '#EEEDFE', color: '#3C3489' },
  'plantao-danilo':  { bg: '#FBEAF0', color: '#993556' },
  'plantao-adriano': { bg: '#EAF3DE', color: '#3B6D11' },
  'plantao-carlos':  { bg: '#FAECE7', color: '#993C1D' },
  'presencial':    { bg: '#F1EFE8', color: '#5F5E5A' }, // cinza
};

// ─── Componente: Tag ─────────────────────────────────────────
// Badge colorido (🏠 Higor, 🏢 Carlos, ⚙ Plantão: Danilo...)
// Busca as cores no TAG_COLORS pelo tipo recebido
function Tag({ type, text }: { type: string; text: string }) {
  const c = TAG_COLORS[type] || TAG_COLORS['presencial'];
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full w-fit block"
      style={{ background: c.bg, color: c.color }}>
      {text}
    </span>
  );
}

// ─── Componente: DayCol ──────────────────────────────────────
// Uma coluna representando um dia (Quarta / Sexta / Sábado)
// Mostra: nome do dia, data, badges de quem está de home/plantão
// note = texto em itálico quando há uma observação (ex: regra de plantão)
function DayCol({ label, date, tags, note }: {
  label: string;
  date: Date;
  tags: { type: string; text: string }[];
  note?: string;
}) {
  return (
    <div className="flex-1 p-3 border-r last:border-r-0" style={{ borderColor: 'var(--border)' }}>
      <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--text)' }}>{fmt(date)}</p>
      <div className="flex flex-col gap-1">
        {tags.map((t, i) => <Tag key={i} type={t.type} text={t.text} />)}
      </div>
      {note && <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--muted2)' }}>{note}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function EscalaPage() {
  // idx = qual mês está sendo exibido (0 = abril, 1 = maio... 8 = dezembro)
  const [idx, setIdx] = useState(0);

  // Pega o ano e mês do item atual da lista de meses
  const { year, month } = ALL_MONTHS[idx];

  // Calcula as semanas do mês selecionado
  const weeks = getWeeksForMonth(year, month);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Título + botões de navegação entre meses */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Escala de Home Office</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Quartas e sextas — plantão sábados</p>
          </div>
          <div className="flex gap-2">
            {/* Desabilitado quando já está no primeiro mês (abril) */}
            <button onClick={() => setIdx(i => i-1)} disabled={idx===0}
              className="px-3 py-1.5 rounded-xl text-sm border transition-all disabled:opacity-30"
              style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }}>
              ← Anterior
            </button>
            {/* Desabilitado quando já está no último mês (dezembro) */}
            <button onClick={() => setIdx(i => i+1)} disabled={idx===ALL_MONTHS.length-1}
              className="px-3 py-1.5 rounded-xl text-sm border transition-all disabled:opacity-30"
              style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }}>
              Próximo →
            </button>
          </div>
        </div>

        {/* Nome do mês atual em destaque */}
        <div className="text-lg font-semibold" style={{ color: 'var(--accent3)' }}>
          {MONTHS[month]} {year}
        </div>

        {/* Legenda de cores */}
        <div className="flex flex-wrap gap-3">
          {[
            { type: 'home-higor',   label: 'Home Higor' },
            { type: 'home-adriano', label: 'Home Adriano' },
            { type: 'home-carlos',  label: 'Home Carlos' },
            { type: 'home-danilo',  label: 'Home Danilo' },
            { type: 'presencial',   label: 'Presencial' },
          ].map(l => (
            <div key={l.type} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="w-2.5 h-2.5 rounded-sm"
                style={{ background: TAG_COLORS[l.type].bg, border: `1px solid ${TAG_COLORS[l.type].color}` }}/>
              {l.label}
            </div>
          ))}
        </div>

        {/* Lista de semanas do mês */}
        <div className="space-y-3">
          {weeks.map(({ mon, quarta, sexta, sabado }, wi) => {

            // Passo 1: número da semana (para saber se é par ou ímpar)
            const weekNum = getWeekNum(mon);

            // Passo 2: quem vai de home na quarta e na sexta essa semana
            const ho = getHomeOffice(weekNum);

            // Passo 3: quem tem plantão no sábado (null se ninguém)
            const plantaoSab = getPlantaoSabado(sabado);

            // Passo 4: aplica a regra do plantão
            // Se quem tem plantão no sábado ia de home na sexta,
            // ele fica presencial na sexta (vai de home na quarta em vez disso)
            const presencialSexta = plantaoSab && (plantaoSab===ho.s1 || plantaoSab===ho.s2)
              ? plantaoSab
              : null;

            // Badges da quarta: sempre dois de home
            const quartaTags = [
              { type: `home-${COR[ho.q1]}`, text: '🏠 '+ho.q1 },
              { type: `home-${COR[ho.q2]}`, text: '🏠 '+ho.q2 },
            ];

            // Badges da sexta: dois de home, exceto quem for presencial
            const sextaTags = [];
            if (ho.s1 !== presencialSexta) sextaTags.push({ type:`home-${COR[ho.s1]}`, text:'🏠 '+ho.s1 });
            if (ho.s2 !== presencialSexta) sextaTags.push({ type:`home-${COR[ho.s2]}`, text:'🏠 '+ho.s2 });
            if (presencialSexta) sextaTags.push({ type:'presencial', text:'🏢 '+presencialSexta });

            // Badges do sábado: quem tem plantão, ou "Sem plantão"
            const sabTags = plantaoSab
              ? [{ type:`plantao-${COR[plantaoSab]}`, text:'⚙ Plantão: '+plantaoSab }]
              : [{ type:'presencial', text:'Sem plantão' }];

            return (
              <div key={wi} className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>

                {/* Cabeçalho da semana com datas e badge de plantão */}
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    Semana {fmt(mon)} – {fmt(addDays(mon,4))}
                  </span>
                  {/* Badge roxo de plantão — só aparece quando há plantão naquela semana */}
                  {plantaoSab && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: '#EEEDFE', color: '#3C3489' }}>
                      Plantão sáb: {plantaoSab}
                    </span>
                  )}
                </div>

                {/* Três colunas: Quarta | Sexta | Sábado */}
                <div className="flex divide-x" style={{ borderColor: 'var(--border)' }}>
                  <DayCol label="Quarta" date={quarta} tags={quartaTags} />
                  <DayCol
                    label="Sexta"
                    date={sexta}
                    tags={sextaTags}
                    // Nota em itálico explicando por que alguém está presencial
                    note={presencialSexta ? presencialSexta+' → presencial (plantão sáb.)' : undefined}
                  />
                  <DayCol label="Sábado" date={sabado} tags={sabTags} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bolinhas de navegação por mês no rodapé
            A bolinha do mês atual fica roxa e preenchida
            As outras ficam com borda apenas */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          {ALL_MONTHS.map(({ month: m }, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className="w-9 h-9 rounded-full text-[11px] font-medium transition-all border"
              style={{
                background: i===idx ? 'var(--accent)' : 'var(--surface)',
                color: i===idx ? '#fff' : 'var(--muted)',
                borderColor: i===idx ? 'var(--accent)' : 'var(--border2)',
              }}>
              {/* slice(0,3) pega só as 3 primeiras letras: Abr, Mai, Jun... */}
              {MONTHS[m].slice(0,3)}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
