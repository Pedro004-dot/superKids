/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { createClient } from '@supabase/supabase-js';

// Tentar obter variáveis de ambiente de diferentes fontes
const getEnvVar = (key: string, fallback?: string): string | undefined => {
  // Vite usa import.meta.env
  if ((import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  // Fallback para process.env (se disponível)
  if ((process.env as any)?.[key]) {
    return (process.env as any)[key];
  }
  return fallback;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidas no arquivo .env');
}

console.log('[Supabase] Inicializando cliente:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NÃO DEFINIDO',
  hasKey: !!supabaseAnonKey
});

// Criar cliente com configurações explícitas
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'superkids-app'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});

console.log('[Supabase] Cliente criado com sucesso');

