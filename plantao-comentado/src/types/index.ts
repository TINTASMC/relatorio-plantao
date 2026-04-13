/*
  types/index.ts — Tipos TypeScript do sistema
  
  TypeScript é uma versão do JavaScript que exige que você defina
  o "formato" dos dados antes de usar. Isso evita erros como tentar
  acessar um campo que não existe.
  
  Pense nos tipos como "moldes" — eles descrevem a estrutura
  dos dados que o sistema vai trabalhar.
*/

// StatusPlantao — os três estados possíveis de um plantão
// O TypeScript não vai deixar colocar outro valor além desses três
export type StatusPlantao = 'Normal' | 'Alerta' | 'Crítico';

// SeveridadeOcorrencia — os três níveis de gravidade de uma ocorrência
export type SeveridadeOcorrencia = 'Baixa' | 'Média' | 'Alta';

// Ocorrencia — formato de uma ocorrência dentro de um relatório
// Cada ocorrência tem esses campos obrigatórios
export interface Ocorrencia {
  id: string;                      // identificador único gerado automaticamente
  horario: string;                 // ex: "09:30"
  titulo: string;                  // ex: "Impressora com defeito"
  descricao: string;               // descrição detalhada do que aconteceu
  severidade: SeveridadeOcorrencia; // Baixa, Média ou Alta
}

// Relatorio — formato completo de um relatório salvo no banco
// Todos os campos que existem na tabela do Supabase
export interface Relatorio {
  id: string;           // UUID gerado pelo Supabase (identificador único)
  numero: number;       // número sequencial: 1, 2, 3... (o #0001 que aparece na tela)
  data: string;         // data no formato "YYYY-MM-DD" (ex: "2026-04-07")
  hora_inicio: string;  // sempre "08:00"
  hora_fim: string;     // "13:00" ou mais tarde se plantão estendido
  plantonista: string;  // nome de quem fez o plantão
  status: StatusPlantao; // Normal, Alerta ou Crítico
  ocorrencias: Ocorrencia[]; // lista de ocorrências (pode ser vazia [])
  observacoes: string;  // texto livre de passagem de plantão
  created_at: string;   // data e hora que o registro foi criado (gerado automaticamente)
}
