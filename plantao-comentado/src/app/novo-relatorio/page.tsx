/*
  app/novo-relatorio/page.tsx — Formulário de abertura de relatório
  
  Esta é a página principal do sistema. Ela guia o plantonista
  por 4 etapas para registrar o relatório do dia.
  
  Etapa 1: Identificação (data, horário, nome, status)
  Etapa 2: Ocorrências (lista de incidentes do plantão)
  Etapa 3: Observações (texto livre de passagem de plantão)
  Etapa 4: Revisão (resumo antes de salvar)
  Etapa 5: Tela de sucesso (após salvar)
*/
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Ocorrencia, StatusPlantao, SeveridadeOcorrencia } from '@/types';
import {
  Plus, Trash2, CheckCircle2, AlertTriangle, AlertOctagon,
  Loader2, ChevronRight, ChevronLeft, Clock, Check,
  FileText, Users, AlertCircle, StickyNote, AlarmClock,
} from 'lucide-react';

// uid() → gera um ID único aleatório para cada ocorrência
// Ex: "a1b2c3d" — serve para identificar cada ocorrência na lista
const uid = () => Math.random().toString(36).slice(2, 9);

// today() → retorna a data de hoje no formato que o banco espera (YYYY-MM-DD)
// Usa o horário LOCAL do computador, não o UTC, para evitar bug de fuso horário
// (sem isso, no Brasil às 22h o sistema salvaria o dia seguinte)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// Horários fixos do plantão
const HORA_INICIO = '08:00';
const HORA_FIM    = '13:00';

// gerarHorarios() → cria uma lista de horários entre dois pontos, de 5 em 5 minutos
// Ex: gerarHorarios('08:00', '09:00') → ['08:00', '08:05', '08:10'... '09:00']
// Usado para preencher os dropdowns de horário sem AM/PM
const gerarHorarios = (inicio: string, fim: string) => {
  const opts: string[] = [];
  const [hI, mI] = inicio.split(':').map(Number);
  const [hF, mF] = fim.split(':').map(Number);
  let h = hI, m = mI;
  while (h < hF || (h === hF && m <= mF)) {
    opts.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += 5;
    if (m >= 60) { m = 0; h++; }
  }
  return opts;
};

// Listas de horários pré-geradas para os dropdowns
const HORARIOS_PLANTAO   = gerarHorarios('08:00', '13:00'); // para ocorrências normais
const HORARIOS_ESTENDIDO = gerarHorarios('13:05', '23:55'); // para plantão estendido

// ─── Componente: Field ───────────────────────────────────────
// Wrapper que exibe o label (rótulo) acima de qualquer campo
// required = true → mostra um asterisco roxo indicando campo obrigatório
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text2)' }}>
        {label}{required && <span className="ml-0.5" style={{ color: 'var(--accent2)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Componente: StepBar ─────────────────────────────────────
// Barra de progresso no topo com as 4 etapas
// Etapas concluídas → ✓ verde | Etapa atual → roxo com brilho | Futuras → cinza
const STEPS = [
  { label: 'Identificação', icon: <Users size={13}/> },
  { label: 'Ocorrências',   icon: <AlertCircle size={13}/> },
  { label: 'Observações',   icon: <StickyNote size={13}/> },
  { label: 'Revisar',       icon: <FileText size={13}/> },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => {
        const idx = i + 1;
        const done   = idx < current; // etapa já foi concluída
        const active = idx === current; // etapa atual
        return (
          <div key={s.label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
                style={{
                  background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--surface3)',
                  color: done || active ? '#fff' : 'var(--muted)',
                  boxShadow: active ? '0 0 0 4px rgba(99,102,241,0.2)' : 'none',
                }}>
                {done ? <Check size={14}/> : s.icon}
              </div>
              <span className="text-[10px] font-medium hidden sm:block"
                style={{ color: active ? 'var(--accent3)' : done ? 'var(--green)' : 'var(--muted2)' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 rounded transition-all duration-300"
                style={{ background: done ? 'var(--green)' : 'var(--border2)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente: StatusSelector ──────────────────────────────
// Três botões para escolher o status geral do plantão
// O botão selecionado fica maior e com borda colorida
function StatusSelector({ value, onChange }: { value: StatusPlantao; onChange: (v: StatusPlantao) => void }) {
  const opts: { v: StatusPlantao; icon: React.ReactNode; color: string; bg: string; bd: string; desc: string }[] = [
    { v: 'Normal',  icon: <CheckCircle2 size={16}/>, color: 'var(--green)',  bg: 'var(--green-bg)',  bd: 'var(--green-bd)',  desc: 'Plantão sem intercorrências' },
    { v: 'Alerta',  icon: <AlertTriangle size={16}/>, color: 'var(--yellow)', bg: 'var(--yellow-bg)', bd: 'var(--yellow-bd)', desc: 'Situação que requer atenção' },
    { v: 'Crítico', icon: <AlertOctagon size={16}/>,  color: 'var(--red)',    bg: 'var(--red-bg)',    bd: 'var(--red-bd)',    desc: 'Incidente grave, ação imediata' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className="rounded-xl p-3 text-left transition-all"
          style={{
            background: value === o.v ? o.bg : 'var(--surface3)',
            border: `1.5px solid ${value === o.v ? o.bd : 'var(--border)'}`,
            boxShadow: value === o.v ? `0 0 0 1px ${o.bd}` : 'none',
            transform: value === o.v ? 'scale(1.02)' : 'scale(1)',
          }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: o.color }}>{o.icon}
            <span className="text-sm font-semibold">{o.v}</span>
          </div>
          <p className="text-[10px] leading-tight" style={{ color: 'var(--muted)' }}>{o.desc}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Componente: HorarioSelect ───────────────────────────────
// Dropdown de horário em formato 24h (sem AM/PM)
// Mostra opções de 5 em 5 minutos dentro do período do plantão
function HorarioSelect({
  value, onChange, horarios, placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  horarios: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 text-sm cursor-pointer"
      style={{
        background: 'var(--surface2)',
        border: '1.5px solid var(--border2)',
        borderRadius: 10,
        color: 'var(--text)',
        width: '100%',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {horarios.map(h => (
        <option key={h} value={h}>{h}</option>
      ))}
    </select>
  );
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function NovoRelatorioPage() {
  const router = useRouter();

  // Estado do fluxo
  const [step, setStep] = useState(1);         // etapa atual (1 a 5)
  const [saving, setSaving] = useState(false);  // true enquanto salva no banco
  const [savedNumero, setSavedNumero] = useState<number | null>(null); // número gerado após salvar

  // Campos da Etapa 1
  const [data, setData] = useState(today());           // data de hoje por padrão
  const [plantonista, setPlantonista] = useState('');  // nome digitado
  const [status, setStatus] = useState<StatusPlantao>('Normal'); // Normal por padrão

  // Campos de extensão de plantão (além das 13h)
  const [plantaoEstendido, setPlantaoEstendido] = useState(false); // botão ativado?
  const [horaFimReal, setHoraFimReal] = useState('');              // novo horário de fim
  const [motivoExtensao, setMotivoExtensao] = useState('');        // motivo digitado

  // Campos da Etapa 2
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]); // lista de ocorrências
  const [addingOc, setAddingOc] = useState(false);                  // mini-formulário aberto?
  const [ocForm, setOcForm] = useState<Omit<Ocorrencia,'id'>>({
    horario: HORA_INICIO, titulo: '', descricao: '', severidade: 'Baixa',
  });

  // Campo da Etapa 3
  const [observacoes, setObservacoes] = useState('');

  // Adiciona a ocorrência em rascunho à lista e limpa o formulário
  function addOcorrencia() {
    if (!ocForm.titulo.trim()) return; // não adiciona se o título estiver vazio
    setOcorrencias(p => [...p, { ...ocForm, id: uid(), titulo: ocForm.titulo.trim() }]);
    setOcForm({ horario: HORA_INICIO, titulo: '', descricao: '', severidade: 'Baixa' });
    setAddingOc(false);
  }

  // Horário de fim real: usa o estendido se ativado, senão usa 13:00
  const horaFimFinal = plantaoEstendido && horaFimReal ? horaFimReal : HORA_FIM;

  // Salva o relatório no Supabase
  async function handleSubmit() {
    setSaving(true);
    try {
      const { data: row, error } = await supabase
        .from('relatorios')
        .insert({
          data,                          // data como string local (evita bug de fuso)
          hora_inicio: HORA_INICIO,
          hora_fim: horaFimFinal,
          plantonista: plantonista.trim(),
          status,
          ocorrencias,
          // Junta as observações com a nota de extensão (se houver)
          observacoes: [
            observacoes.trim(),
            plantaoEstendido && horaFimReal
              ? `⏰ Plantão estendido até ${horaFimReal}${motivoExtensao ? ` — ${motivoExtensao.trim()}` : ''}`
              : ''
          ].filter(Boolean).join('\n\n'),
        })
        .select('numero') // pede que o Supabase retorne o número gerado
        .single();
      if (error) throw error;
      setSavedNumero(row.numero);
      setStep(5); // vai para a tela de sucesso
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar. Verifique as configurações do Supabase.');
    } finally {
      setSaving(false);
    }
  }

  // Reseta todos os campos para abrir um novo relatório do zero
  function resetForm() {
    setStep(1); setSavedNumero(null); setPlantonista(''); setData(today());
    setStatus('Normal'); setOcorrencias([]); setObservacoes('');
    setAddingOc(false); setPlantaoEstendido(false); setHoraFimReal(''); setMotivoExtensao('');
    setOcForm({ horario: HORA_INICIO, titulo: '', descricao: '', severidade: 'Baixa' });
  }

  // ── Tela de sucesso (step 5) ──────────────────────────────
  // Aparece depois que o relatório é salvo com sucesso
  if (step === 5) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header/>
      <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-6 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'var(--green-bg)', border: '2px solid var(--green-bd)' }}>
          <CheckCircle2 size={40} style={{ color: 'var(--green)' }}/>
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Relatório salvo!</h1>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Registrado com sucesso e armazenado permanentemente.</p>
          {savedNumero && (
            <div className="mt-5 inline-flex flex-col items-center rounded-2xl px-8 py-4"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Número do relatório</p>
              {/* padStart(4,'0') transforma 1 em "0001" para exibir como #0001 */}
              <p className="text-4xl font-black" style={{ color: 'var(--accent3)' }}>
                #{String(savedNumero).padStart(4,'0')}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={resetForm}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ border: '1.5px solid var(--border2)', color: 'var(--text2)', background: 'transparent' }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border2)'}>
            Novo relatório
          </button>
          <button onClick={() => router.push('/relatorios')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            Ver relatórios
          </button>
        </div>
      </div>
    </div>
  );

  // ── Formulário principal (steps 1 a 4) ───────────────────
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Header/>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <StepBar current={step}/>

        {/* ════ ETAPA 1 — IDENTIFICAÇÃO ════ */}
        {step === 1 && (
          <div className="fade-up space-y-5">
            <div className="rounded-2xl p-6 space-y-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

              <Field label="Data do Plantão" required>
                <input type="date" value={data} onChange={e => setData(e.target.value)}
                  className="px-3 py-2.5 text-sm" />
              </Field>

              {/* Bloco de horário fixo + botão de extensão */}
              <div>
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-3"
                  style={{ background: 'var(--surface3)', border: '1px solid var(--border)' }}>
                  <Clock size={16} style={{ color: 'var(--accent2)' }}/>
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Horário do Plantão</p>
                    <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--accent3)' }}>
                      08:00 → {plantaoEstendido && horaFimReal ? horaFimReal : '13:00'}
                      {plantaoEstendido && horaFimReal && (
                        <span className="text-xs font-normal ml-2" style={{ color: 'var(--yellow)' }}>estendido</span>
                      )}
                    </p>
                  </div>
                  {/* Botão que ativa/desativa a extensão de plantão */}
                  <button
                    onClick={() => setPlantaoEstendido(v => !v)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: plantaoEstendido ? 'var(--yellow-bg)' : 'var(--surface2)',
                      color: plantaoEstendido ? 'var(--yellow)' : 'var(--muted)',
                      border: `1px solid ${plantaoEstendido ? 'var(--yellow-bd)' : 'var(--border2)'}`,
                    }}>
                    <AlarmClock size={12}/>
                    {plantaoEstendido ? 'Cancelar extensão' : 'Estender plantão'}
                  </button>
                </div>

                {/* Campos de extensão — só aparecem quando o botão está ativado */}
                {plantaoEstendido && (
                  <div className="rounded-xl p-4 space-y-3 fade-in"
                    style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow-bd)' }}>
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--yellow)' }}>
                      <AlarmClock size={12}/> Plantão estendido além das 13:00
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Novo horário de encerramento">
                        <HorarioSelect
                          value={horaFimReal}
                          onChange={setHoraFimReal}
                          horarios={HORARIOS_ESTENDIDO}
                          placeholder="Selecione..."
                        />
                      </Field>
                      <Field label="Motivo da extensão">
                        <input
                          type="text"
                          value={motivoExtensao}
                          onChange={e => setMotivoExtensao(e.target.value)}
                          placeholder="Ex: Aguardando técnico"
                          className="px-3 py-2 text-sm"
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              <Field label="Nome do Plantonista / Responsável" required>
                <input type="text" value={plantonista} onChange={e => setPlantonista(e.target.value)}
                  placeholder="Ex: Higor"
                  className="px-3 py-2.5 text-sm" />
              </Field>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text2)' }}>
                  Status Geral do Plantão <span style={{ color: 'var(--accent2)' }}>*</span>
                </label>
                <StatusSelector value={status} onChange={setStatus}/>
              </div>
            </div>

            <div className="flex justify-end">
              {/* Botão desabilitado se nome vazio, data vazia ou extensão sem horário */}
              <button
                onClick={() => setStep(2)}
                disabled={!plantonista.trim() || !data || (plantaoEstendido && !horaFimReal)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent)' }}>
                Registrar Ocorrências <ChevronRight size={15}/>
              </button>
            </div>
          </div>
        )}

        {/* ════ ETAPA 2 — OCORRÊNCIAS ════ */}
        {step === 2 && (
          <div className="fade-up space-y-5">
            <div className="rounded-2xl p-6 space-y-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Ocorrências e Incidentes</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Horários disponíveis: 08:00 às {horaFimFinal}
                  </p>
                </div>
                {/* Contador roxo de ocorrências — só aparece se tiver alguma */}
                {ocorrencias.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent3)' }}>
                    {ocorrencias.length}
                  </span>
                )}
              </div>

              {/* Estado vazio — aparece quando não há ocorrências e o formulário está fechado */}
              {ocorrencias.length === 0 && !addingOc && (
                <div className="rounded-xl py-8 flex flex-col items-center gap-2"
                  style={{ background: 'var(--surface3)', border: '1px dashed var(--border2)' }}>
                  <CheckCircle2 size={28} style={{ color: 'var(--green)' }}/>
                  <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>Nenhuma ocorrência</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Plantão tranquilo? Ótimo!</p>
                </div>
              )}

              {/* Lista de ocorrências já adicionadas */}
              {ocorrencias.length > 0 && (
                <div className="space-y-2">
                  {ocorrencias.map(oc => (
                    <div key={oc.id} className="rounded-xl p-3.5 flex gap-3"
                      style={{
                        background: 'var(--surface3)',
                        // Linha colorida à esquerda indica a severidade
                        borderLeft: `3px solid ${oc.severidade === 'Alta' ? 'var(--red)' : oc.severidade === 'Média' ? 'var(--yellow)' : 'var(--green)'}`,
                        border: '1px solid var(--border)',
                      }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{oc.titulo}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: oc.severidade === 'Alta' ? 'var(--red-bg)' : oc.severidade === 'Média' ? 'var(--yellow-bg)' : 'var(--green-bg)',
                              color: oc.severidade === 'Alta' ? 'var(--red)' : oc.severidade === 'Média' ? 'var(--yellow)' : 'var(--green)',
                              border: `1px solid ${oc.severidade === 'Alta' ? 'var(--red-bd)' : oc.severidade === 'Média' ? 'var(--yellow-bd)' : 'var(--green-bd)'}`,
                            }}>
                            {oc.severidade}
                          </span>
                          <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--muted)' }}>
                            <Clock size={9}/> {oc.horario}
                          </span>
                        </div>
                        {oc.descricao && <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{oc.descricao}</p>}
                      </div>
                      {/* Botão X vermelho para remover a ocorrência da lista */}
                      <button onClick={() => setOcorrencias(p => p.filter(o => o.id !== oc.id))}
                        className="shrink-0 transition-colors hover:opacity-100 opacity-40"
                        style={{ color: 'var(--red)' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Mini-formulário de nova ocorrência — aparece quando addingOc = true */}
              {addingOc ? (
                <div className="rounded-xl p-4 space-y-3 fade-in"
                  style={{ background: 'var(--surface3)', border: '1.5px solid var(--accent)', borderRadius: 14 }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--accent3)' }}>Nova Ocorrência</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Field label="Título *">
                        <input value={ocForm.titulo} onChange={e => setOcForm(p => ({ ...p, titulo: e.target.value }))}
                          placeholder="Ex: Falha no sistema de alarme"
                          className="px-3 py-2 text-sm" autoFocus />
                      </Field>
                    </div>
                    <Field label="Horário (dentro do plantão)">
                      {/* Dropdown limitado ao período do plantão (ou estendido) */}
                      <HorarioSelect
                        value={ocForm.horario}
                        onChange={v => setOcForm(p => ({ ...p, horario: v }))}
                        horarios={
                          plantaoEstendido && horaFimReal
                            ? gerarHorarios('08:00', horaFimReal)
                            : HORARIOS_PLANTAO
                        }
                      />
                    </Field>
                    <Field label="Severidade">
                      <select value={ocForm.severidade} onChange={e => setOcForm(p => ({ ...p, severidade: e.target.value as SeveridadeOcorrencia }))}
                        className="px-3 py-2 text-sm cursor-pointer">
                        <option>Baixa</option><option>Média</option><option>Alta</option>
                      </select>
                    </Field>
                    <div className="col-span-2">
                      <Field label="Descrição detalhada">
                        <textarea rows={3} value={ocForm.descricao} onChange={e => setOcForm(p => ({ ...p, descricao: e.target.value }))}
                          placeholder="O que aconteceu, como foi resolvido, quem foi acionado..."
                          className="px-3 py-2 text-sm resize-none" />
                      </Field>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setAddingOc(false)}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ color: 'var(--muted)' }}>Cancelar</button>
                    <button onClick={addOcorrencia} disabled={!ocForm.titulo.trim()}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                      style={{ background: 'var(--accent)' }}>
                      <Plus size={13}/> Adicionar
                    </button>
                  </div>
                </div>
              ) : (
                /* Botão tracejado para abrir o formulário de nova ocorrência */
                <button onClick={() => setAddingOc(true)}
                  className="w-full rounded-xl py-2.5 flex items-center justify-center gap-2 text-sm transition-all"
                  style={{ border: '1.5px dashed var(--border2)', color: 'var(--accent2)', background: 'transparent' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border2)'; }}>
                  <Plus size={14}/> Adicionar ocorrência
                </button>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>
                <ChevronLeft size={15}/> Voltar
              </button>
              <button onClick={() => setStep(3)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                Observações Gerais <ChevronRight size={15}/>
              </button>
            </div>
          </div>
        )}

        {/* ════ ETAPA 3 — OBSERVAÇÕES GERAIS ════ */}
        {step === 3 && (
          <div className="fade-up space-y-5">
            <div className="rounded-2xl p-6 space-y-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Observações Gerais</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Passagem de plantão, recados para o próximo responsável, situações em andamento...
                </p>
              </div>
              <textarea
                rows={9}
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder={`Ex:\n— Portão 2 travando, manutenção agendada para amanhã\n— Aguardar técnico às 14h para vistoria da sala 5\n— Chave do almoxarifado deixada com a recepcionista\n— Todos os sistemas operando normalmente ao término do plantão`}
                className="px-3 py-3 text-sm resize-none leading-relaxed"
              />
              {/* Contador de caracteres — útil para saber o tamanho do texto */}
              <p className="text-xs text-right" style={{ color: 'var(--muted2)' }}>
                {observacoes.length} caracteres
              </p>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>
                <ChevronLeft size={15}/> Voltar
              </button>
              <button onClick={() => setStep(4)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
                Revisar e Salvar <ChevronRight size={15}/>
              </button>
            </div>
          </div>
        )}

        {/* ════ ETAPA 4 — REVISÃO ════ */}
        {step === 4 && (
          <div className="fade-up space-y-4">
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Confirmar relatório</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Revise antes de salvar permanentemente.</p>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {/* Faixa colorida no topo muda de cor conforme o status */}
              <div className="h-1.5"
                style={{ background: status === 'Normal' ? 'var(--green)' : status === 'Alerta' ? 'var(--yellow)' : 'var(--red)' }}/>
              <div className="p-5 space-y-4" style={{ background: 'var(--surface)' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Plantonista</p>
                    <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{plantonista}</p>
                  </div>
                  <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5"
                    style={{
                      background: status === 'Normal' ? 'var(--green-bg)' : status === 'Alerta' ? 'var(--yellow-bg)' : 'var(--red-bg)',
                      color: status === 'Normal' ? 'var(--green)' : status === 'Alerta' ? 'var(--yellow)' : 'var(--red)',
                      border: `1px solid ${status === 'Normal' ? 'var(--green-bd)' : status === 'Alerta' ? 'var(--yellow-bd)' : 'var(--red-bd)'}`,
                    }}>
                    {status === 'Normal' && <CheckCircle2 size={12}/>}
                    {status === 'Alerta' && <AlertTriangle size={12}/>}
                    {status === 'Crítico' && <AlertOctagon size={12}/>}
                    {status}
                  </span>
                </div>

                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Data</p>
                    {/* split('-').reverse().join('/') converte 2026-04-07 para 07/04/2026 */}
                    <p style={{ color: 'var(--text)' }}>{data.split('-').reverse().join('/')}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Horário</p>
                    <p style={{ color: 'var(--text)' }}>
                      08:00 → {horaFimFinal}
                      {plantaoEstendido && horaFimReal && (
                        <span className="text-xs ml-2" style={{ color: 'var(--yellow)' }}>⚠ estendido</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Nota de extensão — só aparece se tiver motivo digitado */}
                {plantaoEstendido && horaFimReal && motivoExtensao && (
                  <div className="rounded-xl px-3 py-2 text-xs"
                    style={{ background: 'var(--yellow-bg)', color: 'var(--yellow)', border: '1px solid var(--yellow-bd)' }}>
                    <AlarmClock size={11} className="inline mr-1"/>
                    Extensão: {motivoExtensao}
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)' }}>
                    Ocorrências ({ocorrencias.length})
                  </p>
                  {ocorrencias.length === 0 ? (
                    <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--green)' }}>
                      <CheckCircle2 size={14}/> Nenhuma ocorrência neste plantão
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {ocorrencias.map(oc => (
                        <div key={oc.id} className="flex items-center gap-2 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: oc.severidade === 'Alta' ? 'var(--red)' : oc.severidade === 'Média' ? 'var(--yellow)' : 'var(--green)' }}/>
                          <span style={{ color: 'var(--text)' }}>{oc.titulo}</span>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{oc.horario}</span>
                          <span className="text-[10px]" style={{ color: oc.severidade === 'Alta' ? 'var(--red)' : oc.severidade === 'Média' ? 'var(--yellow)' : 'var(--green)' }}>
                            ({oc.severidade})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações — só aparece se tiver algo escrito */}
                {observacoes && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)' }}>Observações</p>
                    {/* white-space: pre-wrap preserva as quebras de linha do texto */}
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{observacoes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => setStep(3)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>
                <ChevronLeft size={15}/> Voltar
              </button>
              {/* Botão desabilitado e com spinner enquanto está salvando */}
              <button onClick={handleSubmit} disabled={saving}
                className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {saving
                  ? <><Loader2 size={15} className="animate-spin"/> Salvando...</>
                  : <><Check size={15}/> Salvar Relatório</>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
