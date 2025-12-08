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

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'https://nxorwtmtgxvpqmrwhvdx.supabase.co');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'sb_publishable_imX8_j6mo43jKm1g1SnbLw_6A7GJZlM');

console.log('[Supabase] Inicializando cliente:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NÃO DEFINIDO',
  hasKey: !!supabaseAnonKey
});

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

