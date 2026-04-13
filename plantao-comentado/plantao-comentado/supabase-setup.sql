-- ============================================================
-- RELATÓRIO DE PLANTÃO — Setup do Banco (Supabase SQL Editor)
-- Cole aqui e clique em Run ▶
-- ============================================================

CREATE TABLE IF NOT EXISTS public.relatorios (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  numero       SERIAL       UNIQUE NOT NULL,
  data         DATE         NOT NULL,
  hora_inicio  TEXT         NOT NULL DEFAULT '08:00',
  hora_fim     TEXT         NOT NULL DEFAULT '13:00',
  plantonista  TEXT         NOT NULL,
  status       TEXT         NOT NULL DEFAULT 'Normal'
                            CHECK (status IN ('Normal','Alerta','Crítico')),
  ocorrencias  JSONB        NOT NULL DEFAULT '[]',
  observacoes  TEXT         NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ  DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relatorios_data        ON public.relatorios (data DESC);
CREATE INDEX IF NOT EXISTS idx_relatorios_plantonista ON public.relatorios (plantonista);
CREATE INDEX IF NOT EXISTS idx_relatorios_status      ON public.relatorios (status);

ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_publica"     ON public.relatorios FOR SELECT USING (true);
CREATE POLICY "insercao_publica"    ON public.relatorios FOR INSERT WITH CHECK (true);
CREATE POLICY "atualizacao_publica" ON public.relatorios FOR UPDATE USING (true);
