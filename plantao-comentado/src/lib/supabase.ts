/*
  lib/supabase.ts — Conexão com o banco de dados
  
  Este arquivo cria a "ponte" entre o sistema e o Supabase.
  Ele é importado em qualquer página que precise ler ou salvar dados.
  
  O createClient recebe dois valores das variáveis de ambiente:
  - NEXT_PUBLIC_SUPABASE_URL: o endereço do seu projeto no Supabase
  - NEXT_PUBLIC_SUPABASE_ANON_KEY: a chave de acesso público
  
  Esses valores ficam no arquivo .env.local (nunca sobe para o GitHub)
  e nas configurações do Vercel (Settings → Environment Variables).
  
  O "!" no final de cada variável diz ao TypeScript:
  "confie em mim, essa variável vai existir quando o código rodar"
*/
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
