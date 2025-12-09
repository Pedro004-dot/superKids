
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';
import { MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, BATCH_SIZE, GENRES, TONES, ComicFace, Beat, Persona, TokenStats, GATE_PAGE, VisualStyleBase, CompleteStory } from './types';
import { Setup } from './Setup';
import { Book } from './Book';
import { useApiKey } from './useApiKey';
import { ApiKeyDialog } from './ApiKeyDialog';
import { AdminPage } from './AdminPage';
import { AuthPage } from './AuthPage';
import { LandingPage } from './LandingPage';
import { Gallery } from './Gallery';
import { ProfileTab } from './ProfileTab';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

// --- Constants ---
const MODEL_V3 = "gemini-3-pro-image-preview";
const MODEL_IMAGE_GEN_NAME = MODEL_V3;
const MODEL_TEXT_NAME = MODEL_V3;

// --- Supabase REST API Constants (from environment variables) ---
const getEnvVar = (key: string): string => {
  const value = (import.meta as any).env?.[key];
  if (!value) {
    console.error(`[Config] ❌ Variável ${key} NÃO DEFINIDA!`);
    throw new Error(`Environment variable ${key} is not defined. Please add it to your .env file.`);
  }
  console.log(`[Config] ✓ ${key} carregada (${value.substring(0, 20)}...)`);
  return value;
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');
const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1`;
const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1`;

// Validar se ANON_KEY é JWT válida (deve começar com eyJ)
if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
  console.error('[Config] ❌ ERRO: ANON_KEY não é JWT válida!');
  console.error('[Config] Formato atual:', SUPABASE_ANON_KEY.substring(0, 30));
  console.error('[Config] Você está usando Publishable Key ao invés de Anon Key!');
  console.error('[Config] Use a chave que começa com "eyJ..." do dashboard do Supabase');
  alert('⚠️ ERRO DE CONFIGURAÇÃO:\n\nVocê está usando a chave errada!\n\nUse a ANON KEY (formato JWT), não a Publishable Key.\n\nVerifique o arquivo .env e CONFIGURACAO.md');
}

console.log('[Config] ✓ Supabase URL:', SUPABASE_URL);
console.log('[Config] ✓ Anon Key formato:', SUPABASE_ANON_KEY.startsWith('eyJ') ? 'JWT válida ✓' : 'INVÁLIDA ❌');
console.log('[Config] ✓ REST API URL:', SUPABASE_REST_URL);
console.log('[Config] ✓ Storage URL:', SUPABASE_STORAGE_URL);

// --- Helper: Get Auth Token from active session (with auto-refresh and TIMEOUT) ---
const getAuthToken = async (): Promise<string | null> => {
  const startTime = Date.now();
  console.log('[getAuthToken] 🔑 Obtendo token...');
  
  try {
    // TIMEOUT de 2 segundos - se getSession travar, retornar null
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.error('[getAuthToken] ⏱️ TIMEOUT (2s) - getSession travou!');
        resolve(null);
      }, 2000);
    });
    
    const result = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (!result) {
      console.error('[getAuthToken] ❌ getSession travou ou falhou');
      return null;
    }
    
    const { data: { session }, error } = result;
    
    console.log('[getAuthToken] ⏱️ getSession levou:', Date.now() - startTime, 'ms');
    
    if (error) {
      console.warn('[getAuthToken] ❌ Erro ao obter sessão:', error.message);
      return null;
    }
    
    if (session?.access_token) {
      // Verificar se o token vai expirar em breve (menos de 60s)
      const expiresAt = session.expires_at || 0;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;
      
      console.log(`[getAuthToken] ⏰ Token válido por mais ${timeUntilExpiry}s`);
      
      if (timeUntilExpiry < 60) {
        console.warn('[getAuthToken] ⚠️ Token expirando em breve, forçando refresh...');
        const refreshStart = Date.now();
        
        // Timeout também no refresh
        const refreshPromise = supabase.auth.refreshSession();
        const refreshTimeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.error('[getAuthToken] ⏱️ TIMEOUT (2s) - refreshSession travou!');
            resolve(null);
          }, 2000);
        });
        
        const refreshResult = await Promise.race([refreshPromise, refreshTimeoutPromise]);
        
        if (!refreshResult) {
          console.error('[getAuthToken] ❌ refreshSession travou, usando token antigo');
          return session.access_token;
        }
        
        const { data: { session: refreshedSession }, error: refreshError } = refreshResult;
        
        console.log('[getAuthToken] ⏱️ refreshSession levou:', Date.now() - refreshStart, 'ms');
        
        if (refreshError || !refreshedSession) {
          console.error('[getAuthToken] ❌ Erro ao fazer refresh:', refreshError?.message);
          return session.access_token; // Retornar token antigo como fallback
        }
        
        console.log('[getAuthToken] ✅ Token refreshed com sucesso');
        return refreshedSession.access_token;
      }
      
      console.log('[getAuthToken] ✅ Token válido (total:', Date.now() - startTime, 'ms)');
      return session.access_token;
    }
    
    console.warn('[getAuthToken] ⚠️ Nenhuma sessão ativa encontrada');
    return null;
  } catch (e) {
    console.error('[getAuthToken] ❌ Exceção (tempo:', Date.now() - startTime, 'ms):', e);
    return null;
  }
};

// --- Helper: Check if JWT token is expired ---
const isTokenExpired = (token: string): boolean => {
  try {
    // Decodificar JWT (base64)
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    
    if (!exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = exp - now;
    
    console.log(`[isTokenExpired] Token expira em ${timeUntilExpiry}s`);
    
    return timeUntilExpiry <= 0;
  } catch (e) {
    console.error('[isTokenExpired] Erro ao verificar token:', e);
    return true;
  }
};

// --- Helper: Fetch with timeout ---
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Timeout após ${timeoutMs}ms`);
    }
    throw error;
  }
};

// --- REST API Helper: Upload Image to Storage ---
const uploadImageToStorage = async (
  filePath: string,
  blob: Blob,
  retries: number = 3
): Promise<string> => {
  const url = `${SUPABASE_STORAGE_URL}/object/comics-images/${filePath}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Obter token fresco em cada tentativa (garante que não está expirado)
      const token = await getAuthToken();
      
      console.log(`[uploadImageToStorage] Tentativa ${attempt}/${retries} para ${filePath}`);
      console.log(`[uploadImageToStorage] Token disponível: ${!!token}`);
      
      // Verificar se token está expirado
      if (token && isTokenExpired(token)) {
        console.warn(`[uploadImageToStorage] ⚠️ Token expirado detectado, tentando refresh...`);
        // getAuthToken já faz refresh se necessário, então obter novamente
        const freshToken = await getAuthToken();
        if (!freshToken) {
          console.error(`[uploadImageToStorage] ❌ Não foi possível obter token válido`);
        }
      }
      
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': blob.type || 'image/jpeg',
            'x-upsert': 'true'
          },
          body: blob
        },
        60000 // 60s timeout
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[uploadImageToStorage] Erro HTTP ${response.status}:`, errorText);
        
        // Se 401 ou 403 (token expirado/inválido), tentar com token fresco
        if ((response.status === 401 || response.status === 403) && attempt < retries) {
          console.warn(`[uploadImageToStorage] ${response.status} na tentativa ${attempt}, obtendo token fresco...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff exponencial
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      // Obter URL pública
      const publicUrl = `${SUPABASE_STORAGE_URL}/object/public/comics-images/${filePath}`;
      console.log(`[uploadImageToStorage] ✅ Upload bem-sucedido: ${filePath}`);
      return publicUrl;
      
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`[uploadImageToStorage] ❌ Falhou após ${retries} tentativas:`, error.message);
        throw error;
      }
      console.warn(`[uploadImageToStorage] Tentativa ${attempt} falhou (${error.message}), tentando novamente...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff exponencial
    }
  }
  
  throw new Error('Upload falhou após todas as tentativas');
};

// --- REST API Helper: Upload PDF to Storage ---
const uploadPDFToStorage = async (
  filePath: string,
  pdfBlob: Blob,
  retries: number = 2
): Promise<string> => {
  const url = `${SUPABASE_STORAGE_URL}/object/comics-images/${filePath}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Obter token fresco em cada tentativa (garante que não está expirado)
      const token = await getAuthToken();
      
      console.log(`[uploadPDFToStorage] Tentativa ${attempt}/${retries} para ${filePath} (${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`[uploadPDFToStorage] Token disponível: ${!!token}`);
      
      // Verificar se token está expirado
      if (token && isTokenExpired(token)) {
        console.warn(`[uploadPDFToStorage] ⚠️ Token expirado detectado, tentando refresh...`);
        const freshToken = await getAuthToken();
        if (!freshToken) {
          console.error(`[uploadPDFToStorage] ❌ Não foi possível obter token válido`);
        }
      }
      
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/pdf',
            'x-upsert': 'true'
          },
          body: pdfBlob
        },
        120000 // 120s timeout para PDFs grandes
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[uploadPDFToStorage] Erro HTTP ${response.status}:`, errorText);
        
        // Se 401 ou 403 (token expirado/inválido), tentar com token fresco
        if ((response.status === 401 || response.status === 403) && attempt < retries) {
          console.warn(`[uploadPDFToStorage] ${response.status} na tentativa ${attempt}, obtendo token fresco...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const publicUrl = `${SUPABASE_STORAGE_URL}/object/public/comics-images/${filePath}`;
      console.log(`[uploadPDFToStorage] ✅ PDF upload bem-sucedido: ${filePath}`);
      return publicUrl;
      
    } catch (error: any) {
      if (attempt === retries) {
        console.error(`[uploadPDFToStorage] ❌ Falhou após ${retries} tentativas:`, error.message);
        throw error;
      }
      console.warn(`[uploadPDFToStorage] Tentativa ${attempt} falhou (${error.message}), tentando novamente...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw new Error('PDF upload falhou após todas as tentativas');
};

// --- Helper: Test Supabase Connection ---
const testSupabaseConnection = async (): Promise<boolean> => {
  console.log('[Test] ===== TESTANDO CONECTIVIDADE COM SUPABASE =====');
  try {
    const token = await getAuthToken();
    const url = `${SUPABASE_REST_URL}/comics?limit=1`;
    
    console.log('[Test] URL de teste:', url);
    console.log('[Test] Token disponível:', !!token);
    
    // Timeout de 3 segundos para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[Test] ⏱️ Timeout no teste de conectividade (3s)');
      controller.abort();
    }, 3000);
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log('[Test] Status:', response.status);
    console.log('[Test] Status Text:', response.statusText);
    
    if (response.ok) {
      console.log('[Test] ✓ Conectividade OK!');
      return true;
    } else {
      console.error('[Test] ❌ Falha de conectividade:', response.status);
      const errorText = await response.text();
      console.error('[Test] Erro:', errorText);
      return false;
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[Test] ❌ Timeout no teste de conectividade');
    } else {
      console.error('[Test] ❌ Exceção no teste de conectividade:', error);
    }
    return false;
  }
};

// --- Helper: Diagnose Database ---
const diagnoseDatabase = async (): Promise<void> => {
  console.log('[Diagnose] ===== DIAGNÓSTICO DO BANCO DE DADOS =====');
  
  try {
    // Teste 1: Tabela comics existe?
    console.log('[Diagnose] Teste 1: Verificando se tabela comics existe...');
    const { count, error: countError } = await supabase
      .from('comics')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('[Diagnose] ✗ Erro ao acessar tabela:', countError.message);
    } else {
      console.log('[Diagnose] ✓ Tabela comics existe (count:', count, ')');
    }
    
    // Teste 2: User ID válido?
    console.log('[Diagnose] Teste 2: Verificando user ID...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('[Diagnose] ✗ Erro ao obter usuário:', userError.message);
    } else if (!user) {
      console.error('[Diagnose] ✗ Usuário não autenticado');
    } else {
      console.log('[Diagnose] ✓ User ID:', user.id);
      console.log('[Diagnose] ✓ Email:', user.email);
    }
    
    // Teste 3: Pode inserir?
    console.log('[Diagnose] Teste 3: Testando insert...');
    if (user) {
      const testPayload = {
        user_id: user.id,
        hero_name: 'TEST_' + Date.now(),
        genre: 'Test',
        story_tone: 'Test',
        total_pages: 1,
        comic_data: { test: true, timestamp: Date.now() }
      };
      
      console.log('[Diagnose] Payload de teste:', testPayload);
      
      const { data, error: insertError } = await supabase
        .from('comics')
        .insert(testPayload)
        .select()
        .single();
      
      if (insertError) {
        console.error('[Diagnose] ✗ Insert bloqueado!');
        console.error('[Diagnose] Erro:', insertError.message);
        console.error('[Diagnose] Código:', insertError.code);
        console.error('[Diagnose] Detalhes:', insertError.details);
        console.error('[Diagnose] Hint:', insertError.hint);
      } else {
        console.log('[Diagnose] ✓ Insert permitido!');
        console.log('[Diagnose] ✓ Comic de teste criado:', data?.id);
        
        // Limpar teste
        console.log('[Diagnose] Deletando comic de teste...');
        await supabase.from('comics').delete().eq('id', data.id);
        console.log('[Diagnose] ✓ Comic de teste deletado');
      }
    }
    
    console.log('[Diagnose] ===== DIAGNÓSTICO COMPLETO =====');
  } catch (e: any) {
    console.error('[Diagnose] ✗ Erro no diagnóstico:', e);
  }
};

// --- REST API Helper: Save Comic (INSERT) ---
const saveComic = async (payload: any): Promise<any> => {
  console.log('[saveComic] ===== INICIANDO SALVAMENTO =====');
  console.log('[saveComic] Timestamp:', new Date().toISOString());
  
  const url = `${SUPABASE_REST_URL}/comics`;
  console.log('[saveComic] URL:', url);
  console.log('[saveComic] Payload size:', JSON.stringify(payload).length, 'bytes');
  console.log('[saveComic] Payload preview:', JSON.stringify(payload).substring(0, 500) + '...');
  console.log('[saveComic] Payload keys:', Object.keys(payload).join(', '));
  
  // Tentar obter token com timeout de 1s
  console.log('[saveComic] Obtendo token (timeout 1s)...');
  let token: string | null = null;
  
  try {
    const tokenPromise = getAuthToken();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
    token = await Promise.race([tokenPromise, timeoutPromise]);
    console.log('[saveComic] Token obtido:', !!token);
  } catch (err) {
    console.warn('[saveComic] Erro ao obter token (não-crítico):', err);
  }
  
  // RLS ESTÁ DESABILITADO - podemos usar apenas ANON_KEY sem token de usuário
  if (!token) {
    console.warn('[saveComic] ⚠️ Usando apenas ANON_KEY (RLS desabilitado, token não necessário)');
  }
  
  try {
    console.log('[saveComic] Enviando requisição POST...', new Date().toISOString());
    console.log('[saveComic] Headers:', {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY.substring(0, 20) + '...',
      'Authorization': token ? `Bearer ${token.substring(0, 20)}...` : `Bearer ${SUPABASE_ANON_KEY.substring(0, 20)}...`,
      'Prefer': 'return=representation'
    });
    
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          // Se RLS desabilitado, ANON_KEY é suficiente
          'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      },
      5000 // 5s timeout
    );
    
    console.log('[saveComic] Response recebida!');
    console.log('[saveComic] Status:', response.status);
    console.log('[saveComic] Status Text:', response.statusText);
    console.log('[saveComic] Headers:', JSON.stringify([...response.headers.entries()]));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[saveComic] ❌ Erro HTTP:', response.status);
      console.error('[saveComic] Erro texto completo:', errorText);
      console.error('[saveComic] Tentando parsear erro como JSON...');
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error('[saveComic] Erro JSON:', errorJson);
      } catch {
        console.error('[saveComic] Erro não é JSON válido');
      }
      
      // Se 401 ou 403, obter token fresco e tentar novamente
      if (response.status === 401 || response.status === 403) {
        console.warn('[saveComic] 401/403 - Tentando obter token fresco...');
        
        let freshToken: string | null = null;
        try {
          const tokenPromise = getAuthToken();
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
          freshToken = await Promise.race([tokenPromise, timeoutPromise]);
          console.log('[saveComic] Token fresco obtido:', !!freshToken);
        } catch (err) {
          console.warn('[saveComic] Erro ao obter token fresco:', err);
        }
        console.log('[saveComic] Tentando retry com novo token...');
        const retryResponse = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${freshToken || SUPABASE_ANON_KEY}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          },
          5000 // 5s timeout
        );
        
        console.log('[saveComic] Retry response status:', retryResponse.status);
        
        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          console.error('[saveComic] ❌ Retry também falhou:', retryResponse.status);
          console.error('[saveComic] Retry erro:', retryErrorText);
          throw new Error(`HTTP ${retryResponse.status}: ${retryErrorText}`);
        }
        
        console.log('[saveComic] ✓ Retry bem-sucedido! Parseando resposta...');
        let data = await retryResponse.json();
        console.log('[saveComic] Data recebida (retry):', data);
        console.log('[saveComic] Data é array?', Array.isArray(data));
        
        if (Array.isArray(data) && data.length > 0) {
          console.log('[saveComic] Extraindo primeiro item do array');
          data = data[0];
        } else if (Array.isArray(data) && data.length === 0) {
          console.error('[saveComic] ❌ ERRO: Array vazio retornado!');
          throw new Error('Nenhum dado retornado do insert (array vazio)');
        }
        
        console.log('[saveComic] ✓ Dados finais (retry):', data);
        console.log('[saveComic] ✓ ID do comic salvo:', data?.id);
        return data;
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    console.log('[saveComic] ✓ Response OK! Parseando resposta...');
    let data;
    try {
      data = await response.json();
      console.log('[saveComic] Data parseada:', data);
      console.log('[saveComic] Data tipo:', typeof data);
      console.log('[saveComic] Data é array?', Array.isArray(data));
    } catch (parseError) {
      console.error('[saveComic] ❌ Erro ao parsear JSON:', parseError);
      throw new Error('Erro ao parsear resposta JSON do servidor');
    }
    
    if (Array.isArray(data) && data.length > 0) {
      console.log('[saveComic] Extraindo primeiro item do array (length:', data.length, ')');
      data = data[0];
    } else if (Array.isArray(data) && data.length === 0) {
      console.error('[saveComic] ❌ ERRO: Array vazio retornado!');
      throw new Error('Nenhum dado retornado do insert (array vazio)');
    }
    
    console.log('[saveComic] ===== SALVAMENTO CONCLUÍDO =====');
    console.log('[saveComic] ✓ Comic ID:', data?.id);
    console.log('[saveComic] ✓ Data completa:', data);
    return data;
    
  } catch (error: any) {
    console.error('[saveComic] ===== ERRO NO SALVAMENTO =====');
    console.error('[saveComic] Erro tipo:', typeof error);
    console.error('[saveComic] Erro mensagem:', error.message);
    console.error('[saveComic] Erro stack:', error.stack);
    console.error('[saveComic] Erro completo:', error);
    throw error;
  }
};

// --- REST API Helper: Update Comic (PATCH) ---
const updateComic = async (comicId: string, updates: Record<string, any>): Promise<void> => {
  const token = await getAuthToken();
  const url = `${SUPABASE_REST_URL}/comics?id=eq.${comicId}`;
  
  console.log('[updateComic] Token disponível:', !!token);
  
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(updates)
      },
      10000 // 10s timeout
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[updateComic] Erro HTTP:', response.status, errorText);
      // Se 401 ou 403, obter token fresco e tentar novamente
      if ((response.status === 401 || response.status === 403) && token) {
        console.warn('[updateComic] Token expirado/inválido, obtendo token fresco...');
        const freshToken = await getAuthToken();
        const retryResponse = await fetchWithTimeout(
          url,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${freshToken || SUPABASE_ANON_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(updates)
          },
          10000
        );
        
        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          throw new Error(`HTTP ${retryResponse.status}: ${retryErrorText}`);
        }
        return;
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
  } catch (error: any) {
    console.error('[updateComic] Erro:', error);
    throw error;
  }
};

// --- Components ---

const LogoText = ({ size = "text-2xl" }: { size?: string }) => (
  <div className="relative flex items-center leading-none group mr-4">
     <span className={`font-comic ${size} text-red-600 tracking-wide`} style={{ textShadow: '1px 1px 0px black' }}>SUPER</span>
     <span className={`font-comic ${size} text-yellow-400 tracking-wide ml-1`} style={{ textShadow: '1px 1px 0px black' }}>KIDS</span>
  </div>
);

const Navbar = ({ activeTab, onTabChange, credits, isGenerating, user, onLogout }: { activeTab: string, onTabChange: (t: string) => void, credits: number, isGenerating: boolean, user: any, onLogout: () => void }) => {
  const generatedCount = 4 - credits;
  const progressPercent = (generatedCount / 4) * 100;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (tab: string) => {
    onTabChange(tab);
    setIsMenuOpen(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-black text-white flex items-center justify-between px-4 z-[1000] border-b-4 border-yellow-400 shadow-lg font-comic">
      <div className="flex items-center gap-4 cursor-pointer pt-1" onClick={() => handleNavClick('create')}>
        <LogoText />
      </div>
      
      {/* Mobile Hamburger Button */}
      <button 
        className="md:hidden text-yellow-400 p-2 focus:outline-none"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {/* Navigation Links (Desktop: Row, Mobile: Dropdown) */}
      <div className={`${isMenuOpen ? 'flex flex-col absolute top-16 left-0 right-0 bg-black border-b-4 border-yellow-400 p-6 gap-6 shadow-xl' : 'hidden'} md:flex md:flex-row md:static md:bg-transparent md:border-none md:p-0 md:gap-6 md:shadow-none transition-all z-50`}>
        <button onClick={() => handleNavClick('create')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'create' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'}`}>Criar</button>
        <button onClick={() => handleNavClick('read')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'read' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'} flex items-center gap-2`}>
          Ler
          {isGenerating && <span className="animate-spin text-yellow-400 text-xs">★</span>}
        </button>
        <button onClick={() => handleNavClick('gallery')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'gallery' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'}`}>Galeria</button>
        <button onClick={() => handleNavClick('profile')} className={`text-xl md:text-xl uppercase hover:text-yellow-400 transition-colors text-left md:text-center ${activeTab === 'profile' ? 'text-yellow-400 underline decoration-2 underline-offset-4' : 'text-gray-300'}`}>Perfil</button>
        <button onClick={onLogout} className="text-xl md:text-xl uppercase hover:text-red-400 transition-colors text-left md:text-center text-gray-300">Sair</button>
      </div>

      {/* Progress Bar (Always visible on desktop, hidden on very small mobile if needed, but usually fits) */}
      <div className="flex flex-col items-end w-24 md:w-48 hidden sm:flex">
         <div className="text-[10px] md:text-xs uppercase text-gray-400 mb-1">{generatedCount}/4 LIVRINHOS CRIADOS</div>
         <div className="w-full h-4 bg-gray-800 border border-gray-600 rounded-full overflow-hidden relative">
            <div 
              className="absolute left-0 top-0 bottom-0 bg-yellow-400 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
         </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- API Key Hook ---
  const { validateApiKey, setShowApiKeyDialog, showApiKeyDialog, handleApiKeyDialogContinue } = useApiKey();

  // --- Global State ---
  const [activeTab, setActiveTab] = useState('create');
  const [credits, setCredits] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // --- Story State ---
  const [hero, setHeroState] = useState<Persona | null>(null);
  const [heroName, setHeroName] = useState("");
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [customPremise, setCustomPremise] = useState("");
  const [storyTone, setStoryTone] = useState(TONES[0]);
  
  // --- Series State ---
  const [comicType, setComicType] = useState<'single' | 'series'>('single');
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesParts, setSeriesParts] = useState(4);
  const [currentSeriesId, setCurrentSeriesId] = useState<string | null>(null);
  
  // --- Token Tracking State ---
  const [tokenStats, setTokenStats] = useState<TokenStats>({ input: 0, output: 0, totalRequests: 0, model: MODEL_V3 });
  const [showAdmin, setShowAdmin] = useState(false);

  // --- Authentication State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  const heroRef = useRef<Persona | null>(null);
  const friendRef = useRef<Persona | null>(null);
  const coverRef = useRef<ComicFace | null>(null);

  const setHero = (p: Persona | null) => { setHeroState(p); heroRef.current = p; };
  
  const [comicFaces, setComicFaces] = useState<ComicFace[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  
  const generatingPages = useRef(new Set<number>());
  const historyRef = useRef<ComicFace[]>([]);

  // --- Profile Stats ---
  const [totalComics, setTotalComics] = useState(0);

  useEffect(() => {
    if (user) {
      // Carregar estatísticas do perfil
      supabase
        .from('comics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => {
          setTotalComics(count || 0);
        });
    }
  }, [user]);

  // --- Authentication Effects ---
  useEffect(() => {
    let isMounted = true;
    console.log('[Auth] ===== INICIANDO VERIFICAÇÃO DE AUTENTICAÇÃO =====');
    console.log('[Auth] Timestamp:', new Date().toISOString());
    const startTime = Date.now();
    
    // Timeout AGRESSIVO de 2s
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] ⏱️ TIMEOUT (2s) na verificação de autenticação');
        console.warn('[Auth] Continuando SEM autenticação (app funciona mesmo assim)');
        setAuthLoading(false);
        if (!user) {
          setShowLanding(false); // Permitir acesso ao app sem auth
          setShowLogin(false);
        }
      }
    }, 2000); // Reduzido para 2s

    // Verificar sessão atual COM timeout manual
    const sessionPromise = supabase.auth.getSession();
    const manualTimeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.error('[Auth] ⏱️ getSession travou (2s)!');
        resolve(null);
      }, 2000);
    });
    
    Promise.race([sessionPromise, manualTimeoutPromise])
      .then(async (result) => {
        if (!isMounted) return;
        
        console.log('[Auth] ⏱️ getSession levou:', Date.now() - startTime, 'ms');
        
        if (!result) {
          console.warn('[Auth] ⚠️ getSession travou, continuando sem auth');
          setAuthLoading(false);
          setUser(null);
          setShowLanding(false);
          setShowLogin(false);
          clearTimeout(timeoutId);
          return;
        }
        
        const { data: { session }, error } = result;
        
        if (error) {
          console.error('[Auth] ❌ Erro ao verificar sessão:', error);
          setAuthLoading(false);
          setUser(null);
          setShowLanding(false); // Permitir acesso sem auth
          setShowLogin(false);
          clearTimeout(timeoutId);
          return;
        }

        if (session?.user) {
          console.log('[Auth] ✅ Usuário autenticado:', {
            id: session.user.id,
            email: session.user.email,
            hasToken: !!session.access_token
          });
          console.log('[Auth] Token no localStorage:', localStorage.getItem('sb-nxorwtmtgxvpqmrwhvdx-auth-token'));
          
          setUser(session.user);
          console.log('[Auth] ✓ User setado no estado:', session.user.id);
          setShowLanding(false);
          setShowLogin(false);
          // Carregar créditos do perfil
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('credits')
              .eq('id', session.user.id)
              .single();
            if (profile && !profileError) {
              setCredits(profile.credits);
            }
          } catch (err) {
            console.error('Erro ao carregar perfil:', err);
            // Continuar mesmo se falhar ao carregar créditos
          }
        } else {
          console.log('[Auth] ⚠️ Nenhuma sessão encontrada');
          setUser(null);
          setShowLanding(false); // Permitir acesso ao app mesmo sem auth
          setShowLogin(false);
        }
        setAuthLoading(false);
        console.log('[Auth] ===== VERIFICAÇÃO COMPLETA =====');
        clearTimeout(timeoutId);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Erro ao verificar sessão:', err);
        setAuthLoading(false);
        setUser(null);
        setShowLanding(true);
        setShowLogin(false);
        clearTimeout(timeoutId);
      });

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      if (session?.user) {
        console.log('[Auth] onAuthStateChange - Usuário autenticado:', {
          id: session.user.id,
          email: session.user.email,
          hasToken: !!session.access_token
        });
        
        setUser(session.user);
        setShowLanding(false);
        setShowLogin(false);
        setAuthLoading(false);
        // Carregar créditos do perfil
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', session.user.id)
            .single();
          if (profile) {
            setCredits(profile.credits);
          }
        } catch (err) {
          console.error('Erro ao carregar perfil:', err);
        }
      } else {
        setUser(null);
        setShowLanding(true);
        setShowLogin(false);
        setCredits(4); // Reset créditos quando deslogar
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveTab('create');
    setComicFaces([]);
    setHero(null);
    setShowLanding(true);
    setShowLogin(false);
  };

  const handleGetStarted = () => {
    setShowLanding(false);
    setShowLogin(true);
  };

  const handleAuthSuccess = () => {
    setShowLogin(false);
    setShowLanding(false);
    // O useEffect vai atualizar o user automaticamente
  };

  // --- AI Helpers ---
  const getAI = () => {
    // Buscar API key do .env via process.env.GEMINI_API_KEY (injetado pelo Vite)
    const apiKey = (process.env as any)?.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('API Key não encontrada. Por favor, configure a chave GEMINI_API_KEY no arquivo .env');
    }
    
    return new GoogleGenAI({ apiKey });
  };

  const trackUsage = (usageMetadata: any, modelName: string) => {
    if (!usageMetadata) return;
    setTokenStats(prev => ({
        input: prev.input + (usageMetadata.promptTokenCount || 0),
        output: prev.output + (usageMetadata.candidatesTokenCount || 0),
        totalRequests: prev.totalRequests + 1,
        model: modelName
    }));
  };

  const handleAPIError = (e: any) => {
    const msg = String(e);
    console.error("API Error:", msg);
    
    // Erro 429 - Quota excedida
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('Quota exceeded')) {
      const errorObj = e?.error || (typeof e === 'object' && e?.error ? e.error : null);
      let retryDelay = '';
      let retrySeconds = 60;
      
      try {
        if (errorObj?.details && Array.isArray(errorObj.details)) {
          const retryInfo = errorObj.details.find((d: any) => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) {
            retrySeconds = Math.ceil(parseInt(retryInfo.retryDelay) || 60);
            retryDelay = ` Por favor, tente novamente em ${retrySeconds} segundos.`;
          }
        }
      } catch (parseErr) {
        // Ignorar erros de parsing
      }
      
      setErrorMessage(
        `⚠️ COTA DA API EXCEDIDA!\n\n` +
        `O modelo Gemini 3 Pro Image requer um plano pago com faturamento ativado no Google Cloud.${retryDelay}\n\n` +
        `SOLUÇÕES:\n` +
        `1. Ative o faturamento: https://console.cloud.google.com/billing\n` +
        `2. Aguarde ${retrySeconds} segundos e tente novamente\n` +
        `3. Verifique seu uso: https://ai.dev/usage`
      );
      setIsGenerating(false);
      return;
    }
    
    // Erros de autenticação/chave API
    if (
      msg.includes('Requested entity was not found') || 
      msg.includes('API_KEY_INVALID') || 
      msg.toLowerCase().includes('permission denied')
    ) {
      setShowApiKeyDialog(true);
      setIsGenerating(false);
      return;
    }
    
    // Outros erros
    const errorPreview = msg.length > 200 ? msg.substring(0, 200) + '...' : msg;
    setErrorMessage(`Erro ao gerar gibi:\n${errorPreview}`);
    setIsGenerating(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- Style Base System ---
  const styleBaseRef = useRef<VisualStyleBase | null>(null);

  const createStyleDefinition = (
    genre: string,
    tone: string
  ): VisualStyleBase => {
    const styleMap: Record<string, VisualStyleBase> = {
      'Aventura de Super-herói': {
        art_style: 'Classic American comic book style (Marvel/DC inspired) - bold, dynamic, action-oriented. NOT Disney style, NOT cartoon style.',
        color_palette: 'Vibrant primary colors (red, blue, yellow) with high contrast. No pastels, no soft colors.',
        line_style: 'Bold black outlines, thick lines, strong definition',
        lighting_style: 'Cinematic lighting, dramatic shadows, clear light sources',
        character_rendering: 'Semi-realistic proportions, expressive poses, dynamic action lines',
      },
      'Reino Mágico': {
        art_style: 'Fantasy illustration style - whimsical but NOT Disney-like, more like European comic books (Tintin style)',
        color_palette: 'Rich jewel tones (emerald, sapphire, ruby), warm magical glows, NO rainbows',
        line_style: 'Elegant flowing lines, medium weight, graceful curves',
        lighting_style: 'Soft gradients with magical light sources, ethereal glow effects',
        character_rendering: 'Stylized but consistent, expressive faces, magical elements',
      },
      'Mistério na Escola': {
        art_style: 'Realistic comic book style - clean lines, detailed backgrounds, mystery comic aesthetic (like Tintin or classic detective comics)',
        color_palette: 'Muted but clear colors, good contrast for readability, school-appropriate palette',
        line_style: 'Clean, precise lines, medium weight, clear definition',
        lighting_style: 'Natural lighting with some dramatic shadows for mystery atmosphere',
        character_rendering: 'Realistic proportions, expressive faces, attention to detail',
      },
      'Viagem Espacial': {
        art_style: 'Sci-fi comic book style - futuristic but accessible, bold and dynamic, space adventure aesthetic',
        color_palette: 'Deep space colors (blues, purples, blacks) with bright accent colors (yellows, greens) for technology',
        line_style: 'Bold lines with some technical details, strong definition',
        lighting_style: 'Dramatic space lighting, bright stars, glowing technology',
        character_rendering: 'Semi-realistic with sci-fi elements, expressive poses',
      },
      'Amigos Animais': {
        art_style: 'Friendly comic book style - warm and approachable, NOT Disney-like, more like classic children\'s book illustrations',
        color_palette: 'Warm, friendly colors (oranges, greens, browns), natural tones, NO rainbows',
        line_style: 'Soft but clear lines, medium weight, friendly appearance',
        lighting_style: 'Bright, cheerful lighting, natural outdoor feel',
        character_rendering: 'Friendly, expressive characters, warm interactions',
      },
      'Esportes Radicais': {
        art_style: 'Dynamic action comic style - high energy, movement-focused, sports comic aesthetic',
        color_palette: 'Energetic colors (bright reds, blues, greens), high contrast for action',
        line_style: 'Bold, dynamic lines, action lines, strong definition',
        lighting_style: 'Bright outdoor lighting, action-focused compositions',
        character_rendering: 'Dynamic poses, action-oriented, expressive movement',
      },
      'Conto de Fadas Moderno': {
        art_style: 'Modern fairy tale illustration style - classic but contemporary, NOT Disney-like, more like European storybook art',
        color_palette: 'Rich, storybook colors (deep blues, purples, golds), warm tones, NO rainbows',
        line_style: 'Elegant lines, medium weight, storybook aesthetic',
        lighting_style: 'Magical but natural lighting, warm and inviting',
        character_rendering: 'Stylized but consistent, expressive, storybook characters',
      },
      'Comédia Maluca': {
        art_style: 'Cartoon comic style - exaggerated but NOT Disney-like, more like classic newspaper comics or modern webcomics',
        color_palette: 'Bright, fun colors, high contrast, playful palette',
        line_style: 'Bold, expressive lines, exaggerated features, clear definition',
        lighting_style: 'Bright, cheerful lighting, comedic compositions',
        character_rendering: 'Exaggerated expressions, comedic poses, fun interactions',
      },
    };
    
    return styleMap[genre] || styleMap['Aventura de Super-herói'];
  };

  // --- Content Guardrails ---
  const CONTENT_GUARDRAILS = `
MANDATORY CONTENT SAFETY RULES (AGES 5-12):
1. ABSOLUTE PROHIBITIONS:
   - NO profanity, swear words, or inappropriate language
   - NO sexual content, references, or innuendos
   - NO romantic relationships between children
   - NO LGBT themes, references, or content
   - NO violence beyond cartoon-style action
   - NO rainbows or multicolor arcs
   - NO kissing, hearts, or romantic gestures

2. LANGUAGE REQUIREMENTS:
   - Simple vocabulary appropriate for ages 5-12
   - Positive, educational, and age-appropriate
   - Focus on friendship, adventure, and learning
   - Encouraging and uplifting messages

3. CHARACTER INTERACTIONS:
   - Only friendship-based relationships
   - No romantic or dating content
   - Positive role models
   - Respectful and kind interactions
`;

  const VISUAL_GUARDRAILS = `
## VISUAL CONTENT GUARDRAILS (AGES 5-12):

### ABSOLUTE PROHIBITIONS:
1. NO RAINBOWS: Never generate rainbows, rainbow colors, or rainbow-like effects
2. NO ROMANTIC GESTURES: No kissing, hugging in romantic context, hearts, or love symbols
3. NO INAPPROPRIATE CONTENT: No suggestive poses, revealing clothing, or adult themes
4. NO VIOLENCE: No weapons, fighting, or aggressive imagery
5. NO SCARY IMAGES: No monsters, horror elements, or frightening visuals

### REQUIRED VISUAL STANDARDS:
1. AGE-APPROPRIATE APPEARANCE: All characters must look like children (5-12 years)
2. APPROPRIATE CLOTHING: Fully dressed, school-appropriate attire
3. POSITIVE EXPRESSIONS: Happy, excited, determined - never sad, angry, or scared
4. SAFE ENVIRONMENTS: Bright, safe-looking settings
5. FRIENDLY CHARACTERS: All characters must appear friendly and approachable
`;

  // Função para otimizar histórico (reduz tokens mantendo contexto)
  const getOptimizedHistory = (history: ComicFace[], currentPage: number, heroNameStr: string): string => {
    if (history.length === 0) {
      return 'This is the first page of the story.';
    }

    if (currentPage <= 3) {
      // Primeiras páginas: histórico completo mas conciso
      return history.map(p => {
        const panels = p.narrative?.panels || [];
        if (panels.length > 0) {
          return `Página ${p.pageIndex}: ${panels.map(panel => panel.scene).join(' → ')}`;
        }
        return `Página ${p.pageIndex}: ${p.narrative?.scene || 'Aventura continua'}`;
      }).join('\n');
    } else {
      // Páginas posteriores: resumo + contexto recente
      const firstPage = history[0];
      const recentPages = history.slice(-2);
      
      const firstScene = firstPage?.narrative?.panels?.[0]?.scene || firstPage?.narrative?.scene || 'iniciou uma aventura';
      const summary = `A história começou quando ${heroNameStr} ${firstScene}.`;
      
      const recent = recentPages.map(p => {
        const panels = p.narrative?.panels || [];
        if (panels.length > 0) {
          return `Página ${p.pageIndex}: ${panels.map(panel => panel.scene).join(' → ')}`;
        }
        return `Página ${p.pageIndex}: ${p.narrative?.scene || 'Aventura continua'}`;
      }).join('\n');
      
      return `${summary}\n\nContexto recente:\n${recent}`;
    }
  };

  // Função auxiliar para tentar reparar JSON incompleto
  const tryRepairJSON = (incompleteJson: string): string => {
    console.log('[tryRepairJSON] Tentando reparar JSON...');
    
    // Contar chaves e colchetes abertos vs fechados
    let openBraces = 0;
    let openBrackets = 0;
    
    for (const char of incompleteJson) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
    
    // Tentar fechar estruturas abertas
    let repaired = incompleteJson.trim();
    
    // Fechar colchetes abertos primeiro
    while (openBrackets > 0) {
      repaired += '\n]';
      openBrackets--;
    }
    
    // Fechar chaves abertas
    while (openBraces > 0) {
      repaired += '\n}';
      openBraces--;
    }
    
    console.log('[tryRepairJSON] JSON reparado, tentando validar...');
    return repaired;
  };

  // --- Generate Complete Story (New Architecture) ---
  const generateCompleteStory = async (
    heroName: string,
    selectedGenre: string,
    storyTone: string,
    customPremise?: string,
    partNumber?: number,
    totalParts?: number,
    previousPartsData?: ComicFace[][],
    seriesTitle?: string
  ): Promise<CompleteStory> => {
    console.log('[generateCompleteStory] Iniciando geração de história completa...');
    
    if (!heroRef.current) {
      console.error('[generateCompleteStory] Erro: Nenhuma imagem de herói disponível');
      throw new Error("No Hero");
    }
    
    try {
      const testAI = getAI();
      console.log('[generateCompleteStory] API key verificada, continuando...');
    } catch (apiKeyError) {
      console.error('[generateCompleteStory] Erro ao obter API key:', apiKeyError);
      throw new Error(`API Key não configurada: ${apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError)}`);
    }

    const langName = "Portuguese (Brazil)";
    const heroNameStr = heroName.trim() || "o herói";
    const styleBase = styleBaseRef.current || createStyleDefinition(selectedGenre, storyTone);

    // Adicionar contexto de séries se aplicável
    let seriesContext = '';
    if (partNumber && partNumber > 1 && previousPartsData && previousPartsData.length > 0) {
      seriesContext = `\n\nCONTEXT FROM PREVIOUS PARTS OF THE SERIES "${seriesTitle || 'Aventura'}":\n`;
      previousPartsData.forEach((partData, idx) => {
        const lastPage = partData[partData.length - 1];
        const lastScene = lastPage?.narrative?.panels?.[0]?.scene || lastPage?.narrative?.scene || 'Aventura continuou';
        seriesContext += `Part ${idx + 1} ended with: ${lastScene}\n`;
      });
      seriesContext += `\nThis is PART ${partNumber} of ${totalParts}. Continue the story from where Part ${partNumber - 1} ended, but ensure this part has its own beginning, middle, and partial ending.`;
    }

    let coreDriver = `GENRE: ${selectedGenre}. TONE: ${storyTone}.`;
    if (selectedGenre === 'Personalizado') {
      coreDriver = `STORY PREMISE: ${customPremise || "A fun adventure for kids"}.`;
    }

    let basePrompt = `
You are writing a complete comic book story FOR CHILDREN (ages 5-12). Generate the ENTIRE story structure for all ${MAX_STORY_PAGES} pages in a single response.

TARGET LANGUAGE FOR TEXT: ${langName}
${coreDriver}
${seriesContext}

CHARACTERS:
- HERO: "${heroNameStr}" (the main protagonist, a child).

${CONTENT_GUARDRAILS}

STORY STRUCTURE:
- Page 1: INCITING INCIDENT - Start with ${heroNameStr} finding something fun or surprising!
- Pages 2-4: ADVENTURE BEGINS - ${heroNameStr} explores the world
- Pages 5-8: A SILLY PROBLEM - A funny obstacle blocks the way
- Pages 9-10: RESOLUTION - They solve the problem together with a HAPPY ENDING

VISUAL STYLE BASE (to be used consistently in all image generations):
- Art Style: ${styleBase.art_style}
- Color Palette: ${styleBase.color_palette}
- Line Style: ${styleBase.line_style}
- Lighting: ${styleBase.lighting_style}
- Character Rendering: ${styleBase.character_rendering}

OUTPUT FORMAT - JSON ONLY:
{
  "story_metadata": {
    "title": "Title of the story",
    "hero_name": "${heroNameStr}",
    "genre": "${selectedGenre}",
    "tone": "${storyTone}",
    "total_pages": ${MAX_STORY_PAGES},
    "visual_style_base": "${styleBase.art_style}"
  },
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "scene_description": "Detailed visual description of panel 1 scene",
          "environment": "Description of the environment/setting",
          "characters": [
            {
              "name": "${heroNameStr}",
              "role": "hero",
              "appearance_notes": "What the character looks like in this panel",
              "dialogue": "Character speech (max 20 words, in ${langName})"
            }
          ],
          "caption": "Narrative text for panel 1 (max 25 words, in ${langName})",
          "dialogue": "Character speech if different from character dialogue",
          "focus_character": "hero",
          "visual_notes": "Specific visual requirements for this panel"
        },
        {
          "panel_number": 2,
          "scene_description": "Detailed visual description of panel 2 scene",
          "environment": "Description of the environment/setting",
          "characters": [
            {
              "name": "${heroNameStr}",
              "role": "hero",
              "appearance_notes": "What the character looks like in this panel",
              "dialogue": "Character speech (max 20 words, in ${langName})"
            }
          ],
          "caption": "Narrative text for panel 2 (max 25 words, in ${langName})",
          "focus_character": "hero",
          "visual_notes": "Specific visual requirements for this panel"
        }
      ]
    },
    ... (repeat for all ${MAX_STORY_PAGES} pages)
  ]
}

CRITICAL REQUIREMENTS:
- Each page must have exactly 2 panels
- All text (captions, dialogue) MUST be in ${langName}
- Page ${MAX_STORY_PAGES} must have a HAPPY ENDING and end with "FIM"
- Maintain narrative continuity across all pages
- Each page should advance the story naturally
- Follow the story structure outlined above
- Ensure all content is age-appropriate (5-12 years)

CRITICAL JSON FORMAT REQUIREMENTS:
- Return ONLY valid JSON, no markdown, no explanations, no code blocks
- The JSON MUST be complete with all ${MAX_STORY_PAGES} pages
- Ensure all brackets [ ] and braces { } are properly closed
- Each page must have complete panel data
- Do NOT truncate the response - include all pages even if it's long
- The JSON must be parseable and valid
`;

    let jsonText = '';
    const MAX_RETRIES = 2;
    let attempt = 0;
    
    while (attempt <= MAX_RETRIES) {
      try {
        // Adicionar instruções extras em tentativas subsequentes
        let currentPrompt = basePrompt;
        if (attempt > 0) {
          currentPrompt += `\n\nCRITICAL: You MUST return a COMPLETE, VALID JSON. The JSON must include all ${MAX_STORY_PAGES} pages with complete panel data. Do not truncate the response. Return ONLY valid JSON, no markdown, no explanations, just the JSON object. Ensure all brackets and braces are properly closed.`;
        }
        
        const ai = getAI();
        console.log(`[generateCompleteStory] Tentativa ${attempt + 1}/${MAX_RETRIES + 1} - Chamando API do Gemini...`);
        
        const result = await ai.models.generateContent({
          model: MODEL_TEXT_NAME,
          contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
          config: {
            temperature: 0.7,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192 // Aumentar limite de tokens de saída
          }
        });

        console.log('[generateCompleteStory] Resposta recebida da API');
        trackUsage(result.usageMetadata, MODEL_TEXT_NAME);

        // Verificar se a resposta foi truncada
        const finishReason = result.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS' || finishReason === 'OTHER') {
          console.warn(`[generateCompleteStory] Resposta pode estar truncada. Finish reason: ${finishReason}`);
        }

        const candidates = result.candidates?.[0]?.content?.parts || [];
        jsonText = '';
        
        for (const part of candidates) {
          if (part.text) {
            jsonText += part.text;
          }
        }

        if (!jsonText) {
          throw new Error("No JSON response from AI");
        }

        console.log(`[generateCompleteStory] JSON recebido, tamanho: ${jsonText.length} caracteres`);

        // Limpar JSON (remover markdown code blocks se houver)
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Verificar se JSON parece completo (tem chaves de fechamento)
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        const openBrackets = (jsonText.match(/\[/g) || []).length;
        const closeBrackets = (jsonText.match(/\]/g) || []).length;

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
          console.warn(`[generateCompleteStory] JSON parece incompleto. Braces: ${openBraces}/${closeBraces}, Brackets: ${openBrackets}/${closeBrackets}`);
          if (attempt < MAX_RETRIES) {
            console.log('[generateCompleteStory] Tentando novamente com prompt mais específico...');
            attempt++;
            continue;
          } else {
            // Tentar reparar JSON incompleto
            console.log('[generateCompleteStory] Tentando reparar JSON incompleto...');
            jsonText = tryRepairJSON(jsonText);
          }
        }

        console.log('[generateCompleteStory] Parsing JSON...');
        const completeStory: CompleteStory = JSON.parse(jsonText);

        // Validar estrutura
        if (!completeStory.pages || completeStory.pages.length !== MAX_STORY_PAGES) {
          throw new Error(`Invalid story structure: expected ${MAX_STORY_PAGES} pages, got ${completeStory.pages?.length || 0}`);
        }

        // Validar que cada página tem painéis
        for (const page of completeStory.pages) {
          if (!page.panels || page.panels.length === 0) {
            throw new Error(`Page ${page.page_number} has no panels`);
          }
        }

        console.log('[generateCompleteStory] História completa gerada com sucesso!');
        return completeStory;

      } catch (error) {
        console.error(`[generateCompleteStory] Erro na tentativa ${attempt + 1}:`, error);
        
        if (error instanceof SyntaxError) {
          console.error('[generateCompleteStory] JSON inválido. Primeiros 1000 caracteres:', jsonText?.substring(0, 1000));
          console.error('[generateCompleteStory] Últimos 500 caracteres:', jsonText?.substring(Math.max(0, jsonText.length - 500)));
          
          if (attempt < MAX_RETRIES) {
            console.log('[generateCompleteStory] Tentando novamente...');
            attempt++;
            continue;
          }
        }
        
        // Se esgotou tentativas ou erro não é de sintaxe, lançar erro
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Failed to generate complete story after ${MAX_RETRIES + 1} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        attempt++;
      }
    }
    
        throw new Error("Failed to generate complete story");
  };

  const generateBeat = async (
    history: ComicFace[], 
    isRightPage: boolean, 
    pageNum: number,
    partNumber?: number,
    totalParts?: number,
    previousPartsData?: ComicFace[][],
    seriesTitle?: string
  ): Promise<Beat> => {
    if (!heroRef.current) {
      console.error('[generateBeat] Erro: Nenhuma imagem de herói disponível');
      throw new Error("No Hero");
    }
    
    console.log(`[generateBeat] Iniciando geração da página ${pageNum}`);
    
    // Verificar se API key está disponível antes de tentar usar
    try {
      const testAI = getAI();
      console.log('[generateBeat] API key verificada, continuando...');
    } catch (apiKeyError) {
      console.error('[generateBeat] Erro ao obter API key:', apiKeyError);
      throw new Error(`API Key não configurada: ${apiKeyError instanceof Error ? apiKeyError.message : String(apiKeyError)}`);
    }

    const isFinalPage = pageNum === MAX_STORY_PAGES;
    const langName = "Portuguese (Brazil)";
    const heroNameStr = heroName.trim() || "o herói";

    const relevantHistory = history
        .filter(p => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
        .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

    // Adicionar contexto de séries se aplicável
    let seriesContext = '';
    if (partNumber && partNumber > 1 && previousPartsData && previousPartsData.length > 0) {
      seriesContext = `\n\nCONTEXT FROM PREVIOUS PARTS OF THE SERIES "${seriesTitle || 'Aventura'}":\n`;
      previousPartsData.forEach((partData, idx) => {
        const lastPage = partData[partData.length - 1];
        const lastScene = lastPage?.narrative?.panels?.[0]?.scene || lastPage?.narrative?.scene || 'Aventura continuou';
        seriesContext += `Part ${idx + 1} ended with: ${lastScene}\n`;
      });
      seriesContext += `\nThis is PART ${partNumber} of ${totalParts}. Continue the story from where Part ${partNumber - 1} ended, but ensure this part has its own beginning, middle, and partial ending.`;
    }

    // Criar histórico otimizado
    const historyText = getOptimizedHistory(relevantHistory, pageNum, heroNameStr);

    // Criar resumo narrativo da história até agora
    const storySummary = relevantHistory.length > 0 
      ? `RESUMO DA HISTÓRIA ATÉ AGORA:\n` +
        (() => {
          const firstPage = relevantHistory[0];
          const firstScene = firstPage?.narrative?.panels?.[0]?.scene || firstPage?.narrative?.scene || 'encontrou algo interessante';
          return `A aventura começou quando ${heroNameStr} ${firstScene}.\n` +
            (relevantHistory.length > 1 
              ? `Nas páginas seguintes, ${heroNameStr} ${relevantHistory.slice(1).map(p => {
                  const scene = p.narrative?.panels?.[0]?.scene || p.narrative?.scene;
                  return scene;
                }).filter(Boolean).join(', depois ')}.\n`
              : '') +
            `Agora estamos na página ${pageNum}, continuando esta emocionante jornada.`;
        })()
      : `Esta é o início da aventura de ${heroNameStr}.`;

    let coreDriver = `GENRE: ${selectedGenre}. TONE: ${storyTone}.`;
    if (selectedGenre === 'Personalizado') {
        coreDriver = `STORY PREMISE: ${customPremise || "A fun adventure for kids"}.`;
    }
    
    const guardrails = `
    MANDATORY GUARDRAILS — FOLLOW THEM IN 100% OF ALL GENERATIONS.
    1. ABSOLUTE PROHIBITION OF RAINBOWS: Never generate, describe, or include rainbows in any form.
    2. ABSOLUTE PROHIBITION OF ROMANCE BETWEEN CHILDREN: No dating, crushes, or romantic affection.
    3. CHILD SAFETY RULES (ALWAYS ACTIVE): No profanity, simple vocabulary, fully dressed characters.
    `;

    let instruction = `Continue the story naturally from where it left off. ALL OUTPUT TEXT (Captions, Dialogue) MUST BE IN ${langName.toUpperCase()}. ${coreDriver} ${guardrails}`;
    instruction += ` CRITICAL: The protagonist's name is "${heroNameStr}".`;
    instruction += ` Maintain narrative continuity with previous pages. Reference events, characters, or objects mentioned earlier when relevant.`;

    // Always use rich mode instructions
    instruction += " RICH MODE ENABLED. Prioritize expressive character feelings and descriptive captions.";
    instruction += " Ensure smooth story flow - each page should feel like a natural continuation of the previous one.";

    if (isFinalPage) {
        instruction += " FINAL PAGE. RESOLVE THE STORY COMPLETELY. HAPPY ENDING. Text must end with 'FIM'. NO CLIFFHANGERS. The story MUST be self-contained.";
    } else {
        if (pageNum === 1) {
            instruction += ` INCITING INCIDENT. Start with ${heroNameStr} finding something fun or surprising!`;
        } else if (pageNum <= 4) {
            instruction += ` ADVENTURE BEGINS. ${heroNameStr} explores the world.`;
        } else if (pageNum <= 8) {
            instruction += " A SILLY PROBLEM. A funny obstacle blocks the way.";
        } else {
            instruction += " RESOLUTION STARTING. They solve the problem together.";
        }
    }

    const capLimit = "max 25 words";
    const diaLimit = "max 20 words";

    const prompt = `
You are writing a comic book script FOR CHILDREN. PAGE ${pageNum} of ${MAX_STORY_PAGES}.
TARGET LANGUAGE FOR TEXT: ${langName}
${coreDriver}
${seriesContext}

CHARACTERS:
- HERO: "${heroNameStr}" (the main protagonist, a child).
- OTHER CHARACTERS: Only include if they were introduced in previous pages.

${storySummary}

DETAILED HISTORY OF PREVIOUS PAGES:
${historyText || 'This is the first page of the story.'}

INSTRUCTIONS:
${instruction}
This page will have 2 comic panels arranged vertically (one on top, one on bottom). Create 2 distinct panels that tell a cohesive story progression across the page.
Each panel should be larger and more detailed than a 4-panel layout, with more space for dialogue and action.
Each panel should advance the narrative significantly, creating a clear sense of story progression.

OUTPUT JSON ONLY:
{
  "panels": [
    {
      "caption": "Narrative text for panel 1 (${capLimit}).",
      "dialogue": "Character speech for panel 1 (${diaLimit}).",
      "scene": "Visual description of panel 1 scene.",
      "focus_char": "hero" or "friend" or "other"
    },
    {
      "caption": "Narrative text for panel 2 (${capLimit}).",
      "dialogue": "Character speech for panel 2 (${diaLimit}).",
      "scene": "Visual description of panel 2 scene.",
  "focus_char": "hero" or "friend" or "other"
    }
  ]
}
`;

    const ai = getAI();
    const result = await ai.models.generateContent({
      model: MODEL_TEXT_NAME,
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      }
    });

    trackUsage(result.usageMetadata, MODEL_TEXT_NAME);
    
    const text = result.text;
    if (!text) throw new Error("No text generated");

    try {
        const parsed = JSON.parse(text);
        // Garantir que temos panels
        if (!parsed.panels || !Array.isArray(parsed.panels)) {
          // Fallback: criar 2 painéis a partir de dados legados se existirem
          const defaultPanel = {
            caption: parsed.caption || "",
            dialogue: parsed.dialogue || "",
            scene: parsed.scene || "A fun adventure scene.",
            focus_char: (parsed.focus_char || "hero") as 'hero' | 'friend' | 'other'
          };
          const beat: Beat = {
            panels: [defaultPanel, defaultPanel],
            scene: parsed.scene || "A fun adventure scene.",
            focus_char: (parsed.focus_char || "hero") as 'hero' | 'friend' | 'other'
          };
          return beat;
        }
        // Garantir que temos exatamente 2 painéis
        if (parsed.panels.length !== 2) {
          // Se tiver mais ou menos, ajustar para 2
          if (parsed.panels.length > 2) {
            parsed.panels = parsed.panels.slice(0, 2);
          } else if (parsed.panels.length === 1) {
            parsed.panels.push({ ...parsed.panels[0] });
          } else {
            // Se estiver vazio, criar 2 painéis padrão
            const defaultPanel = {
              caption: "",
              dialogue: "",
              scene: "A fun adventure scene.",
              focus_char: "hero" as const
            };
            parsed.panels = [defaultPanel, defaultPanel];
          }
        }
        // Garantir que retorna um Beat válido
        const beat: Beat = {
          panels: parsed.panels,
          scene: parsed.panels[0]?.scene || "A fun adventure scene.",
          focus_char: parsed.panels[0]?.focus_char || "hero"
        };
        return beat;
    } catch (e) {
        console.error(`[generateBeat] JSON Parse Error para página ${pageNum}`, e);
        console.error("Texto recebido:", text);
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
             try { 
               const parsed = JSON.parse(jsonMatch[1]);
               if (parsed.panels && Array.isArray(parsed.panels)) return parsed;
             } catch(e2) {}
        }
        // Fallback: retornar 2 painéis padrão
        const defaultPanel = {
          caption: "",
          dialogue: "",
          scene: "A fun adventure scene.",
          focus_char: "hero" as const
        };
        const beat: Beat = {
          panels: [defaultPanel, defaultPanel],
          scene: "A fun adventure scene.",
          focus_char: "hero"
        };
        return beat;
    }
  };

  // --- Convert CompleteStory to Beats ---
  const convertCompleteStoryToBeats = (completeStory: CompleteStory): Beat[] => {
    return completeStory.pages.map(page => {
      const panels = page.panels.map(panel => ({
        caption: panel.caption,
        dialogue: panel.dialogue || panel.characters.find(c => c.dialogue)?.dialogue,
        scene: panel.scene_description,
        focus_char: panel.focus_character
      }));
      
      return {
        panels,
        scene: page.panels[0]?.scene_description || '',
        focus_char: page.panels[0]?.focus_character || 'hero'
      } as Beat;
    });
  };

  // --- Build Image Prompt (Hierarchical Structure) ---
  const buildImagePrompt = (
    pageData: CompleteStory['pages'][0],
    pageNum: number,
    visualStyleBase: VisualStyleBase,
    previousImages: string[],
    heroNameStr: string
  ): string => {
    let prompt = `# COMIC BOOK PAGE GENERATION - PAGE ${pageNum} of ${MAX_STORY_PAGES}

## SECTION 1: MANDATORY STYLE DEFINITION
### Art Style: ${visualStyleBase.art_style}
### Color Palette: ${visualStyleBase.color_palette}
### Line Style: ${visualStyleBase.line_style}
### Lighting: ${visualStyleBase.lighting_style}
### Character Rendering: ${visualStyleBase.character_rendering}

CRITICAL: This style definition MUST be applied consistently to EVERY page.
DO NOT deviate from this style. DO NOT mix styles (e.g., do not combine comic book style with Disney style).
Maintain this exact visual aesthetic throughout the entire comic.

## SECTION 2: VISUAL CONTEXT FROM PREVIOUS PAGES
${previousImages.length > 0 ? `
The following images show the visual style and continuity from previous pages.
You MUST maintain the same art style, color palette, and visual consistency.
` : 'This is the first story page.'}

## SECTION 3: CONTENT GUARDRAILS
${VISUAL_GUARDRAILS}

## SECTION 4: CHARACTER CONSISTENCY
The main character "${heroNameStr}" MUST:
1. Use the provided reference image for facial features EXACTLY
2. Match: eye color, hair color, hair style, face shape, skin tone
3. Maintain same appearance across ALL panels and pages
4. Reference image is the DEFINITIVE source - do NOT create variations
5. If character appears in multiple panels, they must look IDENTICAL

## SECTION 5: CURRENT PAGE LAYOUT
LAYOUT: Create a vertical layout with 2 large comic panels. Arrange them as:
  [Panel 1 - Top Half]
  [Panel 2 - Bottom Half]

Each panel should take up approximately 50% of the page height.
Panels should be clearly separated with a visible border/gutter between them.
Each panel is LARGE - use the full space available for clear, readable text and detailed artwork.

PANEL DESCRIPTIONS:
`;

    pageData.panels.forEach((panel, idx) => {
      prompt += `\nPANEL ${idx + 1} (${idx === 0 ? 'Top' : 'Bottom'} Half):\n`;
      prompt += `  Scene: ${panel.scene_description}\n`;
      prompt += `  Environment: ${panel.environment}\n`;
      if (panel.caption) {
        prompt += `  Caption: "${panel.caption}" (display in yellow/cream caption box at top or bottom of panel, large and readable)\n`;
      }
      if (panel.dialogue) {
        prompt += `  Dialogue: "${panel.dialogue}" (display in white speech bubble with black border, large and clear, positioned within the panel without overlapping other elements)\n`;
      }
      panel.characters.forEach(char => {
        if (char.dialogue && char.dialogue !== panel.dialogue) {
          prompt += `  ${char.name} says: "${char.dialogue}" (display in white speech bubble)\n`;
        }
        if (char.role === 'hero' || char.role === 'other') {
          prompt += `  Main character: ${char.name} (use provided reference image - CRITICAL: match the face exactly)\n`;
          if (char.appearance_notes) {
            prompt += `  Appearance notes: ${char.appearance_notes}\n`;
          }
        }
      });
      if (panel.visual_notes) {
        prompt += `  Visual notes: ${panel.visual_notes}\n`;
      }
    });

    prompt += `\n## SECTION 6: FINAL REQUIREMENTS
- Fill entire frame edge-to-edge, no white borders
- High contrast, vibrant colors suitable for children
- Clear visual storytelling with expressive character poses
- Professional comic book aesthetic
- Speech bubbles: white background, black border, bold readable text
- Caption boxes: yellow/cream background, black border, classic comic style
- Each panel is large (50% of page) - use the space wisely
- Speech bubbles and captions must fit WITHIN each panel's boundaries
- Do NOT let text or bubbles overflow outside panel borders
- Text should be large and easily readable
- Leave adequate space between dialogue and captions
`;

    return prompt;
  };

  // --- Generate Image with Style Context (Refactored) ---
  const generateImageWithStyleContext = async (
    pageData: CompleteStory['pages'][0],
    pageNum: number,
    visualStyleBase: VisualStyleBase,
    previousImages: string[],
    heroReference: string
  ): Promise<string> => {
    console.log(`[generateImageWithStyleContext] Iniciando para página ${pageNum}`);
    
    if (!heroReference) {
      console.error('[generateImageWithStyleContext] ERRO: heroReference não disponível');
      throw new Error("No Hero Reference");
    }
    
    console.log('[generateImageWithStyleContext] Obtendo AI instance...');
    let ai;
    try {
      ai = getAI();
      console.log('[generateImageWithStyleContext] AI obtido com sucesso');
    } catch (aiError) {
      console.error('[generateImageWithStyleContext] ERRO ao obter AI:', aiError);
      throw aiError;
    }
    
    const prompt = buildImagePrompt(pageData, pageNum, visualStyleBase, previousImages, heroName);
    
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: heroReference } }
    ];

    // Adicionar imagem de referência de estilo (capa)
    if (visualStyleBase.reference_image && pageNum > 1) {
      const styleRefBase64 = visualStyleBase.reference_image.split(',')[1] || visualStyleBase.reference_image;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: styleRefBase64
        }
      });
      console.log('[generateImageWithStyleContext] Imagem de referência de estilo adicionada');
    }

    // Adicionar imagens das páginas anteriores (últimas 2-3)
    previousImages.forEach((imgBase64, idx) => {
      const base64 = imgBase64.split(',')[1] || imgBase64;
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64
        }
      });
      console.log(`[generateImageWithStyleContext] Imagem anterior ${idx + 1} adicionada como contexto`);
    });

    console.log(`[generateImageWithStyleContext] Chamando API do Gemini para gerar imagem...`);
    console.log(`[generateImageWithStyleContext] Model: ${MODEL_IMAGE_GEN_NAME}`);
    console.log(`[generateImageWithStyleContext] Parts count: ${parts.length}`);

    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.4
      }
    });

    console.log(`[generateImageWithStyleContext] Resposta recebida da API`);
    trackUsage(result.usageMetadata, MODEL_IMAGE_GEN_NAME);

    console.log(`[generateImageWithStyleContext] Processando candidatos...`);
    const candidates = result.candidates?.[0]?.content?.parts || [];
    console.log(`[generateImageWithStyleContext] Candidatos encontrados: ${candidates.length}`);
    
    for (const part of candidates) {
      if (part.inlineData) {
        console.log(`[generateImageWithStyleContext] Imagem encontrada no candidato`);
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    console.error(`[generateImageWithStyleContext] ERRO: Nenhuma imagem gerada`);
    throw new Error("No image generated");
  };

  // --- Legacy function for compatibility ---
  const generateImageWithVisualContext = async (
    beat: Beat,
    pageNum: number,
    previousBeats: Beat[]
  ): Promise<string> => {
    console.log(`[generateImageWithVisualContext] Iniciando para página ${pageNum}`);
    if (!heroRef.current) {
      console.error('[generateImageWithVisualContext] ERRO: heroRef.current não disponível');
      throw new Error("No Hero");
    }
    console.log('[generateImageWithVisualContext] Obtendo AI instance...');
    let ai;
    try {
      ai = getAI();
      console.log('[generateImageWithVisualContext] AI obtido com sucesso');
    } catch (aiError) {
      console.error('[generateImageWithVisualContext] ERRO ao obter AI:', aiError);
      throw aiError;
    }
    
    const visualGuardrails = "CRITICAL EXCLUSIONS: NO RAINBOWS, NO MULTICOLOR ARCS, NO ROMANTIC GESTURES, NO KISSING, NO HEARTS. Photorealistic, cinematic lighting, 8k resolution, comic book style.";

    // Verificar se temos múltiplos painéis ou formato legado
    const panels = beat.panels || (beat.scene ? [{
      caption: beat.caption,
      dialogue: beat.dialogue,
      scene: beat.scene,
      focus_char: beat.focus_char
    }] : []);
    
    let prompt = `Create a professional comic book page in ${selectedGenre} style. ${visualGuardrails}\n\n`;

    // Adicionar contexto visual das páginas anteriores
    if (previousBeats.length > 0) {
      prompt += `VISUAL CONTINUITY & CONTEXT:\n`;
      prompt += `This is PAGE ${pageNum} of ${MAX_STORY_PAGES}.\n\n`;
      
      // Resumo visual das últimas 2-3 páginas
      const recentBeats = previousBeats.slice(-3);
      prompt += `Previous pages visually established:\n`;
      recentBeats.forEach((prevBeat, idx) => {
        const prevPageNum = pageNum - recentBeats.length + idx;
        const prevPanels = prevBeat.panels || [];
        prevPanels.forEach((panel, panelIdx) => {
          prompt += `- Page ${prevPageNum}, Panel ${panelIdx + 1}: ${panel.scene}\n`;
        });
      });
      
      prompt += `\nIMPORTANT VISUAL REQUIREMENTS:\n`;
      prompt += `- Show clear visual progression from previous pages\n`;
      prompt += `- Maintain consistent character appearance (same clothes, style)\n`;
      prompt += `- Use similar color palette and artistic style\n`;
      prompt += `- If locations/objects were shown before, reference them visually\n`;
      prompt += `- Each page should feel like a natural visual continuation\n`;
      prompt += `- Avoid repeating exact same scenes, show story progression\n`;
      prompt += `- Add visual variety: different camera angles, poses, compositions\n\n`;
    }
    
    if (panels.length === 2) {
      // Layout vertical com 2 quadrinhos
      prompt += `LAYOUT: Create a vertical layout with 2 large comic panels. Arrange them as:\n`;
      prompt += `  [Panel 1 - Top Half]\n`;
      prompt += `  [Panel 2 - Bottom Half]\n\n`;
      prompt += `Each panel should take up approximately 50% of the page height.\n`;
      prompt += `Panels should be clearly separated with a visible border/gutter between them.\n`;
      prompt += `Each panel is LARGE - use the full space available for clear, readable text and detailed artwork.\n\n`;
      
      prompt += `PANEL DESCRIPTIONS:\n`;
      panels.forEach((panel, idx) => {
        prompt += `\nPANEL ${idx + 1} (${idx === 0 ? 'Top' : 'Bottom'} Half):\n`;
        prompt += `  Scene: ${panel.scene}\n`;
        if (panel.caption) {
          prompt += `  Caption: "${panel.caption}" (display in yellow/cream caption box at top or bottom of panel, large and readable)\n`;
        }
        if (panel.dialogue) {
          prompt += `  Dialogue: "${panel.dialogue}" (display in white speech bubble with black border, large and clear, positioned within the panel without overlapping other elements)\n`;
        }
        if (panel.focus_char === 'hero' || panel.focus_char === 'other') {
          prompt += `  Main character: ${heroName} (use provided reference image - CRITICAL: match the face exactly)\n`;
        }
      });
      
      prompt += `\nIMPORTANT LAYOUT RULES:\n`;
      prompt += `- Each panel is large (50% of page) - use the space wisely\n`;
      prompt += `- Speech bubbles and captions must fit WITHIN each panel's boundaries\n`;
      prompt += `- Do NOT let text or bubbles overflow outside panel borders\n`;
      prompt += `- Text should be large and easily readable\n`;
      prompt += `- Leave adequate space between dialogue and captions\n`;
    } else if (panels.length === 4) {
      // Layout legado 2x2 (compatibilidade)
      prompt += `LAYOUT: Create a 2x2 grid of comic panels. Arrange them as:\n`;
      prompt += `  [Panel 1 - Top Left]  [Panel 2 - Top Right]\n`;
      prompt += `  [Panel 3 - Bottom Left]  [Panel 4 - Bottom Right]\n\n`;
      prompt += `Each panel should be clearly separated with visible borders/gutters between them.\n\n`;
      
      prompt += `PANEL DESCRIPTIONS:\n`;
      panels.forEach((panel, idx) => {
        prompt += `\nPANEL ${idx + 1} (${idx < 2 ? 'Top' : 'Bottom'} ${idx % 2 === 0 ? 'Left' : 'Right'}):\n`;
        prompt += `  Scene: ${panel.scene}\n`;
        if (panel.caption) {
          prompt += `  Caption: "${panel.caption}" (display in yellow/cream caption box)\n`;
        }
        if (panel.dialogue) {
          prompt += `  Dialogue: "${panel.dialogue}" (display in white speech bubble with black border)\n`;
        }
        if (panel.focus_char === 'hero' || panel.focus_char === 'other') {
          prompt += `  Main character: ${heroName} (use provided reference image - CRITICAL: match the face exactly)\n`;
        }
      });
    } else {
      // Formato legado - painel único
      const panel = panels[0];
      prompt += `SCENE DESCRIPTION: ${panel.scene}\n\n`;
      
      if (panel.focus_char === 'hero' || panel.focus_char === 'other') {
         prompt += `MAIN CHARACTER: A child named ${heroName} (use the provided reference image for their appearance).\n\n`;
      }
      
      if (panel.dialogue) {
        prompt += `- Include a speech bubble with the dialogue: "${panel.dialogue}"\n`;
        prompt += `- Speech bubble should be clearly visible, white background with black border, text in bold readable font\n`;
        prompt += `- Position the speech bubble near the speaking character's mouth\n`;
      }
      
      if (panel.caption) {
        prompt += `- Include a caption box (usually at top or bottom) with the text: "${panel.caption}"\n`;
        prompt += `- Caption box should have yellow/cream background with black border, classic comic book style\n`;
      }
    }
    
    // Instruções gerais sobre balões de fala e texto
    prompt += `\nVISUAL REQUIREMENTS:\n`;
    prompt += `- High contrast, vibrant colors suitable for children\n`;
    prompt += `- Clear visual storytelling with expressive character poses\n`;
    prompt += `- Fill the entire frame edge-to-edge, no white borders or empty spaces\n`;
    prompt += `- Ensure all text in speech bubbles and captions is large, clear, and easily readable\n`;
    prompt += `- Maintain authentic comic book aesthetic with bold lines and expressive artwork\n`;
    prompt += `- Speech bubbles: white background, black border, bold readable text\n`;
    prompt += `- Caption boxes: yellow/cream background, black border, classic comic style\n`;
    
    // CRITICAL: Consistência facial
    prompt += `\nCRITICAL FACIAL CONSISTENCY REQUIREMENTS:\n`;
    prompt += `- The main character "${heroName}" MUST use the provided reference image for their face in EVERY panel\n`;
    prompt += `- The character's facial features, hair color, hair style, and general appearance MUST match the reference image EXACTLY\n`;
    prompt += `- Do NOT create variations of the character's face - use the reference image as the definitive source\n`;
    prompt += `- If the character appears in multiple panels, they must look identical in all of them\n`;
    prompt += `- Pay special attention to: eye color, hair color, hair style, face shape, skin tone\n`;
    prompt += `- The reference image shows the EXACT appearance that must be maintained throughout the entire comic\n`;
    
    // Garantir que sempre envia a imagem de referência
    if (!heroRef.current || !heroRef.current.base64) {
      throw new Error("Hero reference image is required but not available");
    }
    
    const parts: any[] = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: heroRef.current.base64 } }
    ];

    console.log(`[generateImageWithVisualContext] Chamando API do Gemini para gerar imagem...`);
    console.log(`[generateImageWithVisualContext] Model: ${MODEL_IMAGE_GEN_NAME}`);
    console.log(`[generateImageWithVisualContext] Parts count: ${parts.length}`);

    const result = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN_NAME,
      contents: [{ role: 'user', parts }],
      config: {
          temperature: 0.4
      }
    });

    console.log(`[generateImageWithVisualContext] Resposta recebida da API`);
    trackUsage(result.usageMetadata, MODEL_IMAGE_GEN_NAME);

    console.log(`[generateImageWithVisualContext] Processando candidatos...`);
    const candidates = result.candidates?.[0]?.content?.parts || [];
    console.log(`[generateImageWithVisualContext] Candidatos encontrados: ${candidates.length}`);
    
    for (const part of candidates) {
        if (part.inlineData) {
          console.log(`[generateImageWithVisualContext] Imagem encontrada no candidato`);
          return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    console.error(`[generateImageWithVisualContext] ERRO: Nenhuma imagem gerada`);
    throw new Error("No image generated");
  };

  // Função legada para compatibilidade
  const generateImage = async (beat: Beat, pageNum: number): Promise<string> => {
    return generateImageWithVisualContext(beat, pageNum, []);
  };

  // --- Main Orchestration ---
  const launchStory = async () => {
      console.log('[launchStory] Iniciando geração de história...');
      
      try {
      const isValid = await validateApiKey();
        console.log('[launchStory] Validação de API key:', isValid);
        if (!isValid) {
          console.warn('[launchStory] API key inválida ou não encontrada');
          setErrorMessage('Por favor, configure a chave da API do Gemini antes de gerar.');
          return;
        }
      } catch (apiKeyError) {
        console.error('[launchStory] Erro ao validar API key:', apiKeyError);
        setErrorMessage('Erro ao validar chave da API. Verifique a configuração.');
        console.error('[launchStory] RETORNANDO devido a erro na validação de API key');
        return;
      }
      
      console.log('[launchStory] Após validação de API key, continuando...');

      if (!heroRef.current) {
        console.warn('[launchStory] Nenhuma imagem de herói carregada');
        setErrorMessage('Por favor, faça upload da imagem do herói antes de gerar.');
        return;
      }

      if (credits <= 0) {
        console.warn('[launchStory] Sem créditos disponíveis');
        setErrorMessage('Você não tem créditos suficientes para gerar um gibi.');
        return;
      }
      
      console.log('[launchStory] Validações passadas. Iniciando geração...');

      // Validar créditos para séries
      const requiredCredits = comicType === 'series' ? (seriesParts || 4) : 1;
      console.log(`[launchStory] Créditos necessários: ${requiredCredits}, disponíveis: ${credits}`);
      if (credits < requiredCredits) {
        setErrorMessage(`Você precisa de ${requiredCredits} créditos para criar ${comicType === 'series' ? 'esta série' : 'este gibi'}. Você tem ${credits} créditos.`);
        return;
      }

      const newCredits = credits - requiredCredits;
      console.log(`[launchStory] Atualizando créditos: ${credits} -> ${newCredits}`);
      setCredits(newCredits);
      
      // Atualizar créditos no banco de dados (sem bloquear a geração)
      if (user) {
        console.log('[launchStory] Usuário autenticado, atualizando créditos no banco...');
        // Executar em background para não bloquear a geração
        (async () => {
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ credits: newCredits })
              .eq('id', user.id);
            if (updateError) {
              console.error('[launchStory] Erro ao atualizar créditos:', updateError);
            } else {
              console.log('[launchStory] Créditos atualizados no banco com sucesso');
            }
          } catch (err) {
            console.error('[launchStory] Exceção ao atualizar créditos:', err);
          }
        })();
        console.log('[launchStory] Atualização de créditos iniciada em background');
      } else {
        console.warn('[launchStory] Usuário não autenticado, pulando atualização de créditos no banco');
      }
      
      console.log('[launchStory] Configurando estado de geração...');
      setIsGenerating(true);
      setActiveTab('read');
      setCurrentSheetIndex(0);
      console.log('[launchStory] Estado configurado');

      // Lógica de séries
      console.log(`[launchStory] Tipo de gibi: ${comicType}`);
      let seriesId: string | null = null;
      let partNumber = 1;
      let previousPartsData: ComicFace[][] = [];

      if (comicType === 'series') {
        console.log('[launchStory] Processando série...');
        if (currentSeriesId) {
          // Continuar série existente
          seriesId = currentSeriesId;
          const { data: series } = await supabase
            .from('comic_series')
            .select('*')
            .eq('id', currentSeriesId)
            .single();
          
          if (series) {
            partNumber = series.current_part + 1;
            
            // Carregar partes anteriores
            const { data: previousComics } = await supabase
              .from('comics')
              .select('comic_data')
              .eq('series_id', seriesId)
              .order('part_number', { ascending: true });
            
            previousPartsData = (previousComics || []).map(comic => 
              comic.comic_data?.comicFaces || []
            );
          }
        } else {
          // Criar nova série
          const { data: newSeries, error: seriesError } = await supabase
            .from('comic_series')
            .insert({
              user_id: user?.id,
              title: seriesTitle || `Aventuras de ${heroName}`,
              hero_name: heroName,
              genre: selectedGenre,
              story_tone: storyTone,
              total_parts: seriesParts || 4,
              current_part: 1,
              status: 'in_progress'
            })
            .select()
            .single();
          
          if (newSeries && !seriesError) {
            seriesId = newSeries.id;
            setCurrentSeriesId(newSeries.id);
          }
        }
      }

      console.log('[launchStory] Criando estrutura inicial de faces...');
      const initialFaces: ComicFace[] = [];
      initialFaces.push({ id: 'cover', type: 'cover', isLoading: true, pageIndex: 0 });
      for (let i = 1; i <= MAX_STORY_PAGES; i++) {
          initialFaces.push({ 
            id: `page-${i}`, 
            type: 'story', 
            isLoading: true, 
            pageIndex: i,
            seriesId: seriesId || undefined,
            partNumber: comicType === 'series' ? partNumber : undefined,
            isSeriesPart: comicType === 'series'
          });
      }
      initialFaces.push({ id: 'back', type: 'back_cover', isLoading: true, pageIndex: BACK_COVER_PAGE });
      
      console.log('[launchStory] Faces iniciais criadas:', initialFaces.length);
      setComicFaces(initialFaces);
      historyRef.current = [];
      console.log('[launchStory] Estado atualizado, iniciando IIFE assíncrona...');
      console.log('[launchStory] IIFE será executada agora...');

      (async () => {
          try {
            console.log('[launchStory] IIFE iniciada, dentro do try block');
            
            // FASE 0: Definir estilo base
            console.log('[launchStory] FASE 0: Definindo estilo base...');
            const styleBase = createStyleDefinition(selectedGenre, storyTone);
            styleBaseRef.current = styleBase;
            console.log('[launchStory] Estilo base definido:', styleBase.art_style);
            
            // FASE 1: Gerar capa (com imagem de referência)
            console.log('[launchStory] FASE 1: Gerando capa...');
            console.log('[launchStory] Verificando heroRef:', !!heroRef.current, !!heroRef.current?.base64);
            if (!heroRef.current || !heroRef.current.base64) {
              console.error('[launchStory] ERRO: Hero reference image não encontrada');
              throw new Error("Hero reference image is required");
            }
            const coverTitle = comicType === 'series' && seriesTitle 
              ? `${seriesTitle} - Parte ${partNumber}`
              : `SUPER ${heroName}`;
            console.log('[launchStory] Título da capa:', coverTitle);
            const coverPrompt = { 
              scene: `Epic comic book cover for a ${selectedGenre} story starring ${heroName}. Action pose, title text '${coverTitle}' at top. CRITICAL: Use the provided reference image for ${heroName}'s face - match it exactly.`, 
              focus_char: 'hero' 
            } as Beat;
            console.log('[launchStory] Chamando generateImage para capa...');
            const coverImg = await generateImage(coverPrompt, 0);
            console.log('[launchStory] Capa gerada com sucesso, tamanho da imagem:', coverImg?.length || 0);
            
            // Armazenar capa como referência de estilo
            styleBaseRef.current = {
              ...styleBaseRef.current,
              reference_image: coverImg
            };
            
            // Criar face da capa completa e atualizar imediatamente
            const coverFaceForState: ComicFace = {
              id: 'cover',
              type: 'cover',
              isLoading: false,
              imageUrl: coverImg,
              pageIndex: 0
            };
            
            setComicFaces(prev => prev.map(f => f.type === 'cover' ? coverFaceForState : f));
            console.log('[launchStory] Capa atualizada no estado com imagem');
            
            // Salvar referência da capa para uso no salvamento (CRÍTICO)
            coverRef.current = coverFaceForState;
            console.log('[launchStory] Capa salva no coverRef.current');
            
            // Armazenar capa em variável local para uso no salvamento
            const savedCoverFace = coverFaceForState;

            // FASE 2: Gerar história completa (1 requisição)
            console.log('[launchStory] FASE 2: Gerando história completa...');
            const completeStory = await generateCompleteStory(
              heroName,
              selectedGenre,
              storyTone,
              customPremise,
              comicType === 'series' ? partNumber : undefined,
              comicType === 'series' ? (seriesParts || 4) : undefined,
              previousPartsData,
              seriesTitle || undefined
            );
            console.log('[launchStory] História completa gerada com sucesso!');
            
            // Converter CompleteStory para Beats (para compatibilidade)
            const allBeats = convertCompleteStoryToBeats(completeStory);
            
            // Atualizar UI com narrativas
            allBeats.forEach((beat, idx) => {
              const pageNum = idx + 1;
              setComicFaces(prev => prev.map(f => 
                f.pageIndex === pageNum ? { ...f, narrative: beat } : f
              ));
            });

            // FASE 3: Gerar imagens das páginas (1 por vez, com contexto)
            console.log('[launchStory] FASE 3: Gerando imagens das páginas...');
            const previousImages: string[] = [coverImg]; // Começar com capa
            
            for (const pageData of completeStory.pages) {
              const pageNum = pageData.page_number;
              console.log(`[launchStory] Gerando imagem para página ${pageNum}/${MAX_STORY_PAGES}`);
              
              try {
                const recentImages = previousImages.slice(-2); // Últimas 2 imagens
                const img = await generateImageWithStyleContext(
                  pageData,
                  pageNum,
                  styleBaseRef.current!,
                  recentImages,
                  heroRef.current!.base64
                );
                
                if (!img) {
                  throw new Error(`Imagem não foi gerada para página ${pageNum}`);
                }
                
                // Atualizar UI imediatamente
                const finishedFace: ComicFace = {
                  id: `page-${pageNum}`,
                    type: 'story',
                    isLoading: false,
                  pageIndex: pageNum,
                    imageUrl: img,
                  narrative: allBeats[pageNum - 1],
                  seriesId: seriesId || undefined,
                  partNumber: comicType === 'series' ? partNumber : undefined,
                  isSeriesPart: comicType === 'series'
                };
                
                // Atualizar ref
                const existingIndex = historyRef.current.findIndex(f => f.pageIndex === pageNum);
                if (existingIndex >= 0) {
                  historyRef.current[existingIndex] = finishedFace;
                } else {
                historyRef.current.push(finishedFace);
                }
                
                // Atualizar estado
                setComicFaces(prev => {
                  const updated = prev.map(f => 
                    f.pageIndex === pageNum ? finishedFace : f
                  );
                  console.log(`[launchStory] UI atualizada para página ${pageNum}`);
                  return updated;
                });
                
                // Adicionar à lista de imagens anteriores
                previousImages.push(img);
                
              } catch (pageError) {
                console.error(`[launchStory] ERRO ao gerar página ${pageNum}:`, pageError);
                
                // Criar face de erro para manter a estrutura
                const errorFace: ComicFace = {
                  id: `page-${pageNum}`,
                  type: 'story',
                  isLoading: false,
                  pageIndex: pageNum,
                  imageUrl: '', // Sem imagem
                  narrative: allBeats[pageNum - 1],
                  seriesId: seriesId || undefined,
                  partNumber: comicType === 'series' ? partNumber : undefined,
                  isSeriesPart: comicType === 'series'
                };
                
                // Adicionar ao ref mesmo com erro
                const existingIndex = historyRef.current.findIndex(f => f.pageIndex === pageNum);
                if (existingIndex >= 0) {
                  historyRef.current[existingIndex] = errorFace;
                } else {
                  historyRef.current.push(errorFace);
                }
                
                // Atualizar estado com face de erro
                setComicFaces(prev => {
                  const updated = prev.map(f => 
                    f.pageIndex === pageNum ? errorFace : f
                  );
                  console.log(`[launchStory] Página ${pageNum} marcada como erro`);
                  return updated;
                });
                
                // Tentar novamente até 2 vezes
                let retryCount = 0;
                while (retryCount < 2) {
                  retryCount++;
                  console.log(`[launchStory] Tentativa ${retryCount}/2 para página ${pageNum}...`);
                  
                  try {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
                    
                    const retryImg = await generateImageWithStyleContext(
                      pageData,
                      pageNum,
                      styleBaseRef.current!,
                      previousImages.slice(-2),
                      heroRef.current!.base64
                    );
                    
                    if (retryImg) {
                      console.log(`[launchStory] ✅ Página ${pageNum} gerada na tentativa ${retryCount}`);
                      
                      // Atualizar com imagem bem-sucedida
                      const successFace: ComicFace = {
                        ...errorFace,
                        imageUrl: retryImg
                      };
                      
                      // Atualizar ref
                      const retryIndex = historyRef.current.findIndex(f => f.pageIndex === pageNum);
                      if (retryIndex >= 0) {
                        historyRef.current[retryIndex] = successFace;
                      }
                      
                      // Atualizar estado
                      setComicFaces(prev => prev.map(f => 
                        f.pageIndex === pageNum ? successFace : f
                      ));
                      
                      previousImages.push(retryImg);
                      break; // Sair do loop de retry
                    }
                  } catch (retryError) {
                    console.error(`[launchStory] Tentativa ${retryCount} falhou para página ${pageNum}:`, retryError);
                  }
                }
                
                // Se todas as tentativas falharam, continuar sem a imagem
                if (retryCount >= 2) {
                  console.warn(`[launchStory] ⚠️ Página ${pageNum} será pulada após ${retryCount} tentativas`);
                  // Adicionar imagem vazia para manter contexto
                  previousImages.push('');
                }
              }
              
              // Pequeno delay para garantir que o React processe a atualização
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // FASE 4: Gerar contracapa (com imagem de referência)
            if (!heroRef.current || !heroRef.current.base64) {
              throw new Error("Hero reference image is required");
            }
            const backText = comicType === 'series' && partNumber < (seriesParts || 4)
              ? `Fim da Parte ${partNumber}`
              : 'FIM';
            const backPrompt = { 
              scene: `The end of the adventure. ${heroName} waving goodbye. Text '${backText}' in the sky. Warm colors. CRITICAL: Use the provided reference image for ${heroName}'s face - match it exactly.`, 
              focus_char: 'hero' 
            } as Beat;
            const backImg = await generateImage(backPrompt, 11);
            const backCoverFaceForState: ComicFace = {
              id: 'back',
              type: 'back_cover',
              isLoading: false,
              imageUrl: backImg,
              pageIndex: BACK_COVER_PAGE
            };
            setComicFaces(prev => prev.map(f => f.type === 'back_cover' ? backCoverFaceForState : f));
            console.log('[launchStory] Contracapa atualizada no estado com imagem');

            // Salvar gibi no banco de dados após geração completa
            if (user) {
              console.log('[launchStory] Iniciando salvamento no banco de dados...');
              console.log('[launchStory] Usuário autenticado:', user.id);
              
              // Usar as faces já geradas diretamente (mais confiável)
              let coverFace: ComicFace | undefined = savedCoverFace || coverRef.current;
              const backCoverFace: ComicFace = backCoverFaceForState;
              
              // Se ainda não temos a capa, tentar buscar do estado
              if (!coverFace || !coverFace.imageUrl) {
                console.log('[launchStory] Tentando buscar capa do estado...');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const coverFromState = comicFaces.find(f => f.type === 'cover' && f.imageUrl);
                if (coverFromState) {
                  coverFace = coverFromState;
                  console.log('[launchStory] Capa encontrada no estado');
                } else if (coverRef.current && coverRef.current.imageUrl) {
                  coverFace = coverRef.current;
                  console.log('[launchStory] Capa encontrada no ref após busca no estado');
                } else {
                  console.error('[launchStory] ERRO CRÍTICO: Capa não encontrada!');
                  console.error('[launchStory] savedCoverFace:', savedCoverFace);
                  console.error('[launchStory] coverRef.current:', coverRef.current);
                  console.error('[launchStory] Estado comicFaces:', comicFaces.map(f => ({ type: f.type, hasImage: !!f.imageUrl, pageIndex: f.pageIndex })));
                }
              }
              
              const storyFaces = historyRef.current.filter(f => f.imageUrl && f.type === 'story'); // Filtrar apenas story faces com imagem
              
              // Se ainda não temos a capa, não podemos salvar
              if (!coverFace || !coverFace.imageUrl) {
                console.error('[launchStory] ERRO CRÍTICO: Não é possível salvar sem capa!');
                console.error('[launchStory] Estado comicFaces:', JSON.stringify(comicFaces.map(f => ({ 
                  type: f.type, 
                  hasImage: !!f.imageUrl, 
                  pageIndex: f.pageIndex,
                  id: f.id
                })), null, 2));
                setErrorMessage('Gibi gerado com sucesso, mas houve um erro ao salvar (capa não encontrada). Você ainda pode visualizá-lo e fazer download.');
                return; // Não continuar com o salvamento
              }
              
              if (storyFaces.length === 0) {
                console.error('[launchStory] ERRO: Nenhuma página de história encontrada');
                setErrorMessage('Gibi gerado com sucesso, mas houve um erro ao salvar (páginas não encontradas). Você ainda pode visualizá-lo e fazer download.');
                return;
              }
              
              if (!backCoverFace || !backCoverFace.imageUrl) {
                console.error('[launchStory] ERRO: Contracapa não encontrada ou sem imagem');
                // Contracapa não é crítica, podemos continuar
              }
              
              const allFaces: ComicFace[] = [
                coverFace, // Sempre incluir capa (já validada)
                ...storyFaces,
                backCoverFace
              ];
              
              console.log('[launchStory] Dados coletados para salvamento:', {
                user_id: user.id,
                faces_count: allFaces.length,
                has_cover: !!coverFace,
                cover_has_image: !!coverFace?.imageUrl,
                story_faces_count: storyFaces.length,
                has_back: !!backCoverFace,
                back_has_image: !!backCoverFace?.imageUrl,
                series_id: seriesId,
                part_number: comicType === 'series' ? partNumber : null
              });
              
              // FASE 5: Salvar dados básicos primeiro (SEMPRE funciona)
              console.log('[launchStory] FASE 5: Salvando dados básicos no banco...');
              
              // Coletar todas as faces geradas
              const allGeneratedFaces: ComicFace[] = [
                savedCoverFace, // Capa
                ...historyRef.current, // Páginas da história
                backCoverFaceForState // Contracapa
              ];
              
              console.log('[launchStory] Faces coletadas:', allGeneratedFaces.length);
              
              // Validar se todas as faces críticas foram geradas
              const facesWithImages = allGeneratedFaces.filter(f => f.imageUrl && f.imageUrl.length > 0);
              const facesWithoutImages = allGeneratedFaces.filter(f => !f.imageUrl || f.imageUrl.length === 0);
              
              console.log('[launchStory] Faces com imagem:', facesWithImages.length);
              console.log('[launchStory] Faces sem imagem:', facesWithoutImages.length);
              
              if (facesWithoutImages.length > 0) {
                console.warn('[launchStory] ⚠️ Algumas páginas não foram geradas:');
                facesWithoutImages.forEach(face => {
                  console.warn(`  - ${face.type} (página ${face.pageIndex})`);
                });
              }
              
              // Se menos de 50% das páginas foram geradas, considerar falha crítica
              if (facesWithImages.length < allGeneratedFaces.length * 0.5) {
                console.error('[launchStory] ERRO CRÍTICO: Muitas páginas falharam na geração');
                setErrorMessage('Erro na geração: Muitas páginas falharam. Tente novamente.');
                return;
              }
              
              // Dados básicos (SEM imagens, payload pequeno)
              const basicComicData = {
                heroName,
                selectedGenre,
                storyTone,
                customPremise: selectedGenre === 'Personalizado' ? customPremise : null,
                createdAt: new Date().toISOString(),
                totalPages: allGeneratedFaces.length
              };

              // PASSO 1: Salvar dados básicos (SEMPRE funciona)
              console.log('[launchStory] PASSO 1: Salvando dados básicos...');
              console.log('[launchStory] User atual:', {
                id: user?.id,
                email: user?.email,
                isAuthenticated: !!user
              });
              
              // Payload mínimo primeiro (essencial apenas)
              const minimalPayload = {
                user_id: user.id,
                hero_name: heroName || 'Untitled',
                genre: selectedGenre || 'Adventure',
                total_pages: basicComicData.totalPages || 0
              };
              
              // Payload completo (com campos opcionais)
              const basicInsertPayload = {
                ...minimalPayload,
                story_tone: storyTone || null,
                comic_data: basicComicData, // Só dados básicos, sem imagens
                series_id: seriesId || null,
                part_number: comicType === 'series' ? partNumber : null,
                is_series_part: comicType === 'series' || false
              };
              
              console.log('[launchStory] Payload mínimo:', JSON.stringify(minimalPayload).length, 'bytes');
              console.log('[launchStory] Payload completo:', JSON.stringify(basicInsertPayload).length, 'bytes');
              console.log('[launchStory] Dados do payload completo:', {
                user_id: basicInsertPayload.user_id,
                hero_name: basicInsertPayload.hero_name,
                genre: basicInsertPayload.genre,
                total_pages: basicInsertPayload.total_pages,
                story_tone: basicInsertPayload.story_tone,
                has_comic_data: !!basicInsertPayload.comic_data,
                series_id: basicInsertPayload.series_id,
                part_number: basicInsertPayload.part_number,
                is_series_part: basicInsertPayload.is_series_part
              });
              
              console.log('[launchStory] Salvando dados básicos via saveComic...');
              
              let savedComic;
              try {
                setSavingStatus('💾 Salvando gibi no banco de dados...');
                console.log('[launchStory] Chamando saveComic com payload básico...');
                console.log('[launchStory] Timestamp:', new Date().toISOString());
                savedComic = await saveComic(basicInsertPayload);
                console.log('[launchStory] ✅ Dados básicos salvos via REST API!');
                console.log('[launchStory] ✅ Comic ID:', savedComic?.id);
                console.log('[launchStory] Timestamp:', new Date().toISOString());
                setSavingStatus('✅ Gibi salvo com sucesso!');
                
                if (!savedComic || !savedComic.id) {
                  console.error('[launchStory] ERRO: Nenhum dado retornado do insert');
                  setSavingStatus(null);
                  setErrorMessage('Erro ao salvar gibi: Nenhum dado retornado. Você ainda pode visualizá-lo e fazer download.');
                  return;
                }
              } catch (insertError) {
                console.error('[launchStory] ===== ERRO NO INSERT VIA REST API =====');
                console.error('[launchStory] EXCEÇÃO ao salvar dados básicos:', insertError);
                
                // FALLBACK 1: Tentar com payload completo via Supabase Client
                setSavingStatus('🔄 Tentando método alternativo...');
                console.log('[launchStory] ===== FALLBACK 1: Supabase Client (payload completo) =====');
                try {
                  console.log('[launchStory] Usando Supabase Client ao invés de REST API...');
                  const { data, error } = await supabase
                    .from('comics')
                    .insert(basicInsertPayload)
                    .select()
                    .single();
                  
                  if (error) {
                    console.error('[launchStory] ❌ Fallback 1 falhou:', error);
                    console.error('[launchStory] Erro message:', error.message);
                    console.error('[launchStory] Erro code:', error.code);
                    
                    // FALLBACK 2: Tentar com payload mínimo
                    setSavingStatus('🔄 Tentando com dados simplificados...');
                    console.log('[launchStory] ===== FALLBACK 2: Payload Mínimo =====');
                    console.log('[launchStory] Tentando com apenas campos essenciais...');
                    
                    const { data: minData, error: minError } = await supabase
                      .from('comics')
                      .insert(minimalPayload)
                      .select()
                      .single();
                    
                    if (minError) {
                      console.error('[launchStory] ❌ Fallback 2 também falhou:', minError);
                      console.error('[launchStory] Erro message:', minError.message);
                      console.error('[launchStory] Erro code:', minError.code);
                      console.error('[launchStory] Erro details:', minError.details);
                      console.error('[launchStory] Erro hint:', minError.hint);
                      
                      // Executar diagnóstico completo (em background, não bloqueia)
                      setSavingStatus('🔍 Diagnosticando problema...');
                      console.log('[launchStory] Executando diagnóstico completo...');
                      diagnoseDatabase().catch(err => console.warn('[launchStory] Diagnóstico falhou:', err));
                      
                      setSavingStatus(null);
                      if (insertError instanceof Error && insertError.message.includes('Timeout')) {
                        setErrorMessage('⏱️ Timeout ao salvar gibi. Verifique sua conexão e tente novamente.');
                      } else {
                        setErrorMessage(`❌ Erro ao salvar gibi (todos os métodos falharam): ${minError.message}. Abra o console (F12) para ver detalhes técnicos.`);
                      }
                      return;
                    }
                    
                    console.log('[launchStory] ✅ Fallback 2 bem-sucedido! Comic salvo com payload mínimo');
                    setSavingStatus('✅ Gibi salvo (método simplificado)!');
                    savedComic = minData;
                    console.log('[launchStory] ✅ Comic ID:', savedComic?.id);
                    
                    // Atualizar com dados completos depois
                    console.log('[launchStory] Atualizando com dados completos...');
                    try {
                      const { error: updateError } = await supabase
                        .from('comics')
                        .update({
                          story_tone: storyTone,
                          comic_data: basicComicData,
                          series_id: seriesId,
                          part_number: partNumber,
                          is_series_part: comicType === 'series'
                        })
                        .eq('id', savedComic.id);
                      
                      if (updateError) {
                        console.warn('[launchStory] ⚠️ Erro ao atualizar dados completos (não crítico):', updateError);
                      } else {
                        console.log('[launchStory] ✓ Dados completos atualizados');
                      }
                    } catch (updateErr) {
                      console.warn('[launchStory] ⚠️ Exceção ao atualizar (não crítico):', updateErr);
                    }
                    
                    // Não retornar - continuar com o fluxo
                  } else {
                    console.log('[launchStory] ✅ Fallback 1 bem-sucedido! Comic salvo via Supabase Client');
                    setSavingStatus('✅ Gibi salvo (método alternativo)!');
                    savedComic = data;
                    console.log('[launchStory] ✅ Comic ID:', savedComic?.id);
                  }
                  
                  console.log('[launchStory] ✅ Fallback bem-sucedido! Comic salvo via Supabase Client');
                  savedComic = data;
                  console.log('[launchStory] ✅ Comic ID:', savedComic?.id);
                } catch (fallbackError) {
                  console.error('[launchStory] ❌ Fallback também falhou:', fallbackError);
                  
                  // Executar diagnóstico completo
                  console.log('[launchStory] Executando diagnóstico completo...');
                  await diagnoseDatabase();
                  
                  setErrorMessage(`Erro crítico ao salvar gibi (ambos REST e Client falharam). Verifique o console para detalhes técnicos.`);
                  return;
                }
              }
              
              // PASSO 2: Upload de imagens individuais (sequencial, aguardando conclusão)
              setSavingStatus(`📤 Fazendo upload de ${facesWithImages.length} imagens...`);
              console.log('[launchStory] PASSO 2: Fazendo upload das imagens...');
              console.log('[launchStory] Faces que serão processadas:', facesWithImages.length);
              console.log('[launchStory] Executando uploadImagesInBackground...');
              console.log('[launchStory] User ID:', user?.id);
              console.log('[launchStory] Comic ID:', savedComic.id);
              console.log('[launchStory] Faces count:', allGeneratedFaces.length);
              
              try {
                await uploadImagesInBackground(savedComic.id, allGeneratedFaces);
                console.log('[launchStory] ✅ Upload de imagens concluído');
                setSavingStatus('✅ Imagens salvas com sucesso!');
                
                // Limpar status após 3 segundos
                setTimeout(() => setSavingStatus(null), 3000);
              } catch (error) {
                console.error('[launchStory] ❌ Erro no upload de imagens:', error);
                setSavingStatus('⚠️ Algumas imagens não foram salvas');
                
                // Limpar status após 3 segundos
                setTimeout(() => setSavingStatus(null), 3000);
                // Continuar mesmo se upload falhar parcialmente - base64 ainda está no comic_data
              }
              
              // Atualizar contador de gibis
              setTotalComics(prev => prev + 1);
              
              // Se há páginas faltantes, oferecer regeneração
              if (facesWithoutImages.length > 0 && facesWithoutImages.length < allGeneratedFaces.length * 0.5) {
                console.log('[launchStory] Oferecendo regeneração de páginas faltantes...');
                const missingPages = facesWithoutImages
                  .filter(f => f.type === 'story')
                  .map(f => f.pageIndex)
                  .sort()
                  .join(', ');
                
                if (missingPages) {
                  setErrorMessage(`Gibi salvo com sucesso! Algumas páginas falharam (${missingPages}). Você pode tentar gerar novamente ou fazer download do que foi gerado.`);
                }
              }
              
              // Se é série, atualizar status da série
              if (comicType === 'series' && seriesId) {
                const isLastPart = partNumber >= (seriesParts || 4);
                await supabase
                  .from('comic_series')
                  .update({
                    current_part: partNumber,
                    status: isLastPart ? 'completed' : 'in_progress',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', seriesId);
                
                if (isLastPart) {
                  setCurrentSeriesId(null); // Reset para próxima série
                }
              }
            }
            
            // O useEffect vai verificar automaticamente quando todas as páginas estiverem prontas
            // Mas vamos garantir que o estado está atualizado
            setTimeout(() => {
              if (isGenerationComplete()) {
                setIsGenerating(false);
              }
            }, 500);

          } catch (e) {
              console.error("Generation Error", e);
              handleAPIError(e);
              // handleAPIError já define setIsGenerating(false) para erros 429
              // Para outros erros, também precisamos parar a geração
              const errorStr = String(e);
              if (!errorStr.includes('429') && !errorStr.includes('RESOURCE_EXHAUSTED')) {
              setIsGenerating(false);
              }
          }
      })();
  };

  // Função para redimensionar imagem base64 para reduzir tamanho
  const resizeBase64Image = (base64: string, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calcular novo tamanho mantendo proporção
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Converter para base64 com qualidade reduzida
        const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(resizedBase64);
      };
      img.src = base64;
    });
  };

  // Função para gerar PDF e fazer upload para storage
  const generateAndUploadPDFWithFaces = async (faces: ComicFace[]): Promise<string | null> => {
    try {
      console.log('[generateAndUploadPDFWithFaces] Iniciando geração de PDF...');
      console.log('[generateAndUploadPDFWithFaces] Faces recebidas:', faces.length);
      console.log('[generateAndUploadPDFWithFaces] Usuário atual:', user?.id);
      
      if (!user) {
        console.error('[generateAndUploadPDFWithFaces] Usuário não autenticado');
        return null;
      }
      
      // Filtrar e ordenar as páginas corretamente
      const sortedFaces = faces
        .filter(f => f.imageUrl)
        .sort((a, b) => {
          // Ordenar: capa (0), story pages (1-10), contracapa (11)
          const aIndex = a.pageIndex ?? (a.type === 'cover' ? 0 : a.type === 'back_cover' ? 11 : 999);
          const bIndex = b.pageIndex ?? (b.type === 'cover' ? 0 : b.type === 'back_cover' ? 11 : 999);
          return aIndex - bIndex;
        });

      console.log('[generateAndUploadPDFWithFaces] Faces com imagem:', sortedFaces.length);
      
      if (sortedFaces.length === 0) {
        console.error('[generateAndUploadPDFWithFaces] Nenhuma página disponível para gerar PDF');
        return null;
      }

      console.log(`[generateAndUploadPDFWithFaces] Gerando PDF com ${sortedFaces.length} páginas...`);

      // Criar PDF em formato A4 (210mm x 297mm) com compressão
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true // Ativar compressão
      });

      // Dimensões da página A4 em mm
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Margens
      const margin = 5;
      const imageWidth = pageWidth - (margin * 2);
      const imageHeight = pageHeight - (margin * 2);

      sortedFaces.forEach((face, index) => {
        // Adicionar nova página para cada face (exceto a primeira)
        if (index > 0) {
            doc.addPage();
        }

        if (face.imageUrl) {
          // Calcular posição para centralizar a imagem
          const x = margin;
          const y = margin;
          
          // Adicionar imagem ocupando quase toda a página
          try {
            doc.addImage(
              face.imageUrl, 
              'JPEG', 
              x, 
              y, 
              imageWidth, 
              imageHeight,
              undefined,
              'MEDIUM' // Qualidade média para reduzir tamanho
            );
          } catch (error) {
            console.error(`Erro ao adicionar imagem da página ${face.pageIndex || face.type}:`, error);
            // Se falhar, tentar com tamanho menor e qualidade menor
            doc.addImage(
              face.imageUrl, 
              'JPEG', 
              x, 
              y, 
              imageWidth * 0.8, 
              imageHeight * 0.8,
              undefined,
              'FAST'
            );
          }
        }
      });

      console.log('[generateAndUploadPDFWithFaces] PDF gerado, convertendo para blob...');

      // Converter PDF para blob
      const pdfBlob = doc.output('blob');
      console.log(`[generateAndUploadPDFWithFaces] PDF blob criado, tamanho: ${pdfBlob.size} bytes`);

      // Verificar se usuário está autenticado
      if (!user) {
        console.error('[generateAndUploadPDFWithFaces] Usuário não autenticado');
        return null;
      }

      // Gerar nome do arquivo
      const isSeries = sortedFaces.some(f => f.isSeriesPart);
      const seriesPartNum = sortedFaces.find(f => f.partNumber)?.partNumber;
      
      const fileName = isSeries && seriesTitle && seriesPartNum
        ? `SuperKids_${seriesTitle}_Parte${seriesPartNum}.pdf`
        : `SuperKids_${heroName || 'Comic'}.pdf`;

      // Fazer upload para storage via REST API
      const filePath = `${user.id}/pdfs/${crypto.randomUUID()}_${fileName}`;
      console.log(`[generateAndUploadPDFWithFaces] Fazendo upload para: ${filePath}`);
      console.log(`[generateAndUploadPDFWithFaces] Tamanho do arquivo: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);

      try {
        // Usar uploadPDFToStorage (REST API) com retry automático
        const publicUrl = await uploadPDFToStorage(filePath, pdfBlob, 2);
        console.log('[generateAndUploadPDFWithFaces] PDF enviado para storage:', publicUrl);
        return publicUrl;
      } catch (uploadError: any) {
        console.error('[generateAndUploadPDFWithFaces] Erro ao fazer upload do PDF:', uploadError);
        // Logs específicos de erro
        if (uploadError.message?.includes('401')) {
          console.error('[generateAndUploadPDFWithFaces] Erro 401: Token de autenticação inválido ou expirado');
        } else if (uploadError.message?.includes('403')) {
          console.error('[generateAndUploadPDFWithFaces] Erro 403: Sem permissão para fazer upload');
        } else if (uploadError.message?.includes('Timeout')) {
          console.error('[generateAndUploadPDFWithFaces] Erro: Timeout no upload (120s)');
        } else if (uploadError.message?.includes('Network')) {
          console.error('[generateAndUploadPDFWithFaces] Erro: Problema de rede');
        }
        return null;
      }

    } catch (error) {
      console.error('[generateAndUploadPDFWithFaces] Erro ao gerar/fazer upload do PDF:', error);
      return null;
    }
  };

  // Função para gerar PDF e fazer upload para storage (usando comicFaces do estado)
  const generateAndUploadPDF = async (): Promise<string | null> => {
    return generateAndUploadPDFWithFaces(comicFaces);
  };

  // Função para fazer upload das imagens individuais via REST API
  const uploadImagesInBackground = async (comicId: string, faces: ComicFace[]) => {
    console.log('[uploadImagesInBackground] ===== INICIANDO UPLOAD DE IMAGENS VIA REST API =====');
    console.log('[uploadImagesInBackground] Total de faces:', faces.length);
    console.log('[uploadImagesInBackground] User ID:', user?.id);
    console.log('[uploadImagesInBackground] Comic ID:', comicId);
    
    if (!user?.id) {
      console.error('[uploadImagesInBackground] ❌ Usuário não autenticado!');
      return;
    }
    
    try {
      const imageUpdates: Record<string, string> = {};
      let successCount = 0;
      let failCount = 0;
      
      // Processar imagens sequencialmente (evitar sobrecarga)
      for (const face of faces) {
        if (!face.imageUrl || !face.imageUrl.startsWith('data:')) {
          console.log(`[uploadImagesInBackground] Pulando ${face.type} (página ${face.pageIndex}) - sem imagem válida`);
          continue;
        }
        
        try {
          // Redimensionar imagem para reduzir tamanho
          const resizedImage = await resizeBase64Image(face.imageUrl, 800, 0.8);
          
          // Determinar nome da coluna no banco
          let columnName = '';
          if (face.type === 'cover') {
            columnName = 'cover_url';
          } else if (face.type === 'back_cover') {
            columnName = 'back_cover_url';
          } else if (face.pageIndex && face.pageIndex >= 1 && face.pageIndex <= 10) {
            columnName = `page_${face.pageIndex}_url`;
          } else {
            console.warn('[uploadImagesInBackground] Face sem tipo válido:', face);
            continue;
          }
          
          // Construir filePath
          const fileName = `${comicId}/${face.type}-${face.pageIndex || face.id}.jpg`;
          const filePath = `${user.id}/comics/${fileName}`;
          
          console.log(`[uploadImagesInBackground] Processando ${columnName}...`);
          
          // Converter base64 para blob
          const base64Data = resizedImage.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          
          // Upload via REST API (com retry automático)
          const publicUrl = await uploadImageToStorage(filePath, blob);
          
          imageUpdates[columnName] = publicUrl;
          successCount++;
          console.log(`[uploadImagesInBackground] ✅ ${columnName} uploaded: ${publicUrl.substring(0, 50)}...`);
          
          // Atualizar banco imediatamente após cada upload bem-sucedido
          try {
            await updateComic(comicId, { [columnName]: publicUrl });
            console.log(`[uploadImagesInBackground] ✅ ${columnName} URL atualizada no banco`);
          } catch (updateErr) {
            console.error(`[uploadImagesInBackground] ⚠️ Erro ao atualizar ${columnName} no banco:`, updateErr);
            // Continuar mesmo se atualização falhar - URL já está em imageUpdates
          }
          
        } catch (error: any) {
          console.error(`[uploadImagesInBackground] ❌ Erro ao processar ${face.type} (página ${face.pageIndex}):`, error.message);
          // Logs específicos de erro
          if (error.message?.includes('401')) {
            console.error(`[uploadImagesInBackground] Erro 401: Token de autenticação inválido ou expirado para ${face.type}`);
          } else if (error.message?.includes('403')) {
            console.error(`[uploadImagesInBackground] Erro 403: Sem permissão para fazer upload de ${face.type}`);
          } else if (error.message?.includes('Timeout')) {
            console.error(`[uploadImagesInBackground] Erro: Timeout no upload de ${face.type} (60s)`);
          } else if (error.message?.includes('Network') || error.name === 'NetworkError') {
            console.error(`[uploadImagesInBackground] Erro: Problema de rede ao fazer upload de ${face.type}`);
          }
          failCount++;
          // Continuar com próxima imagem mesmo se esta falhar - base64 ainda está no comic_data como fallback
        }
      }
      
      // Atualização final em batch (caso alguma atualização individual tenha falhado)
      if (Object.keys(imageUpdates).length > 0) {
        console.log('[uploadImagesInBackground] Atualização final em batch:', Object.keys(imageUpdates).length, 'URLs');
        try {
          await updateComic(comicId, imageUpdates);
          console.log(`[uploadImagesInBackground] ✅ Batch update concluído`);
        } catch (err) {
          console.error('[uploadImagesInBackground] ⚠️ Erro no batch update:', err);
        }
      }
      
      console.log(`[uploadImagesInBackground] ===== CONCLUÍDO: ${successCount} sucessos, ${failCount} falhas =====`);
      
      // Se storage falhar completamente, manter base64 no comic_data como fallback
      if (successCount === 0 && failCount > 0) {
        console.warn('[uploadImagesInBackground] ⚠️ ATENÇÃO: Nenhuma imagem foi salva no storage. Base64 permanece no comic_data como fallback.');
        // Nota: O comic_data já contém as imagens em base64, então o gibi ainda pode ser visualizado
      }
      
      // PASSO 3: Tentar gerar PDF (opcional) - só se pelo menos 50% das imagens foram salvas
      if (successCount > 0 && successCount >= faces.filter(f => f.imageUrl?.startsWith('data:')).length * 0.5) {
        console.log('[uploadImagesInBackground] PASSO 3: Tentando gerar PDF...');
        await generatePDFInBackground(comicId, faces);
      } else {
        console.warn('[uploadImagesInBackground] PDF não será gerado - muitas imagens falharam');
      }
      
    } catch (error: any) {
      console.error('[uploadImagesInBackground] ❌ Erro geral:', error);
      // Logs específicos de erro geral
      if (error.message?.includes('401')) {
        console.error('[uploadImagesInBackground] Erro 401: Token de autenticação inválido ou expirado');
      } else if (error.message?.includes('403')) {
        console.error('[uploadImagesInBackground] Erro 403: Sem permissão para fazer upload');
      } else if (error.message?.includes('Timeout')) {
        console.error('[uploadImagesInBackground] Erro: Timeout geral no processo de upload');
      } else if (error.message?.includes('Network') || error.name === 'NetworkError') {
        console.error('[uploadImagesInBackground] Erro: Problema de rede geral');
      }
      // Continuar mesmo com erro - base64 ainda está no comic_data como fallback
    }
  };

  // Função para gerar PDF em background (opcional)
  const generatePDFInBackground = async (comicId: string, faces: ComicFace[]) => {
    try {
      console.log('[generatePDFInBackground] Gerando PDF...');
      const pdfUrl = await generateAndUploadPDFWithFaces(faces);
      
      if (pdfUrl) {
        // Atualizar banco com URL do PDF via REST API
        try {
          await updateComic(comicId, { pdf_url: pdfUrl });
          console.log('[generatePDFInBackground] ✅ PDF URL atualizada no banco:', pdfUrl);
        } catch (updateError: any) {
          console.error('[generatePDFInBackground] Erro ao salvar PDF URL:', updateError);
          // Continuar mesmo se atualização falhar - PDF já foi gerado
        }
      } else {
        console.warn('[generatePDFInBackground] PDF não foi gerado, mas gibi já está salvo');
      }
    } catch (error: any) {
      console.error('[generatePDFInBackground] Erro ao gerar PDF:', error);
      // Logs específicos de erro
      if (error.message?.includes('401')) {
        console.error('[generatePDFInBackground] Erro 401: Token de autenticação inválido');
      } else if (error.message?.includes('403')) {
        console.error('[generatePDFInBackground] Erro 403: Sem permissão');
      } else if (error.message?.includes('Timeout')) {
        console.error('[generatePDFInBackground] Erro: Timeout na geração/upload do PDF');
      }
    }
  };

  const handleDownload = async () => {
    try {
      console.log('[handleDownload] Iniciando download...');
      
      // Filtrar e ordenar as páginas corretamente
      const sortedFaces = comicFaces
        .filter(f => f.imageUrl)
        .sort((a, b) => {
          // Ordenar: capa (0), story pages (1-10), contracapa (11)
          const aIndex = a.pageIndex ?? (a.type === 'cover' ? 0 : a.type === 'back_cover' ? 11 : 999);
          const bIndex = b.pageIndex ?? (b.type === 'cover' ? 0 : b.type === 'back_cover' ? 11 : 999);
          return aIndex - bIndex;
        });

      if (sortedFaces.length === 0) {
        setErrorMessage('Nenhuma página disponível para download.');
        return;
      }

      // Criar PDF em formato A4 (210mm x 297mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Dimensões da página A4 em mm
      const pageWidth = 210;
      const pageHeight = 297;
      
      // Margens
      const margin = 5;
      const imageWidth = pageWidth - (margin * 2);
      const imageHeight = pageHeight - (margin * 2);

      // Processar cada face
      for (let index = 0; index < sortedFaces.length; index++) {
        const face = sortedFaces[index];
        
        // Adicionar nova página para cada face (exceto a primeira)
        if (index > 0) {
          doc.addPage();
        }

        if (face.imageUrl) {
          console.log(`[generateAndUploadPDFWithFaces] Processando página ${index + 1}/${sortedFaces.length}`);
          
          // Redimensionar imagem se for base64 para reduzir tamanho
          let processedImageUrl = face.imageUrl;
          if (face.imageUrl.startsWith('data:')) {
            try {
              processedImageUrl = await resizeBase64Image(face.imageUrl, 1200, 0.85);
              console.log(`[generateAndUploadPDFWithFaces] Imagem ${index + 1} redimensionada`);
            } catch (error) {
              console.warn(`[generateAndUploadPDFWithFaces] Falha ao redimensionar imagem ${index + 1}, usando original`);
            }
          }
          
          // Calcular posição para centralizar a imagem
          const x = margin;
          const y = margin;
          
          // Adicionar imagem ocupando quase toda a página
          try {
            doc.addImage(
              processedImageUrl, 
              'JPEG', 
              x, 
              y, 
              imageWidth, 
              imageHeight,
              undefined,
              'MEDIUM' // Qualidade média para reduzir tamanho
            );
          } catch (error) {
            console.error(`Erro ao adicionar imagem da página ${face.pageIndex || face.type}:`, error);
            // Se falhar, tentar com tamanho menor e qualidade menor
            try {
              doc.addImage(
                processedImageUrl, 
                'JPEG', 
                x, 
                y, 
                imageWidth * 0.8, 
                imageHeight * 0.8,
                undefined,
                'FAST'
              );
            } catch (fallbackError) {
              console.error(`Erro crítico ao adicionar imagem ${index + 1}:`, fallbackError);
            }
          }
        }
      }

      // Salvar PDF localmente
      const isSeries = sortedFaces.some(f => f.isSeriesPart);
      const seriesPartNum = sortedFaces.find(f => f.partNumber)?.partNumber;
      
      const fileName = isSeries && seriesTitle && seriesPartNum
        ? `SuperKids_${seriesTitle}_Parte${seriesPartNum}.pdf`
        : `SuperKids_${heroName || 'Comic'}.pdf`;
      
      doc.save(fileName);
      console.log(`[handleDownload] PDF baixado com ${sortedFaces.length} páginas`);
    } catch (error) {
      console.error('[handleDownload] Erro ao gerar PDF:', error);
      setErrorMessage('Erro ao gerar PDF para download.');
    }
  };

  // --- Render ---

  // Sheet Navigation
  const prevPage = () => {
     if (currentSheetIndex > 0) setCurrentSheetIndex(p => p - 1);
  };
  const nextPage = () => {
     if (currentSheetIndex < Math.ceil(TOTAL_PAGES / 2)) setCurrentSheetIndex(p => p + 1);
  };

  // Função para verificar se geração está completa
  const isGenerationComplete = () => {
    const hasCover = comicFaces.some(f => f.type === 'cover' && f.imageUrl);
    const storyPages = comicFaces.filter(f => f.type === 'story');
    const hasAllStoryPages = storyPages.length === MAX_STORY_PAGES && storyPages.every(f => f.imageUrl);
    const hasBackCover = comicFaces.some(f => f.type === 'back_cover' && f.imageUrl);
    return hasCover && hasAllStoryPages && hasBackCover;
  };

  // useEffect para verificar quando geração está completa
  useEffect(() => {
    if (isGenerating && isGenerationComplete()) {
      setIsGenerating(false);
    }
  }, [comicFaces, isGenerating]);

  // Status computation for display
  const generatedPagesCount = comicFaces.filter(f => f.type === 'story' && f.imageUrl).length;
  const isActuallyGenerating = isGenerating && !isGenerationComplete();
  
  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#222] flex items-center justify-center">
        <div className="text-white text-4xl font-comic animate-pulse">CARREGANDO...</div>
      </div>
    );
  }

  // Mostrar landing page se não estiver autenticado e não estiver na tela de login
  if (!user && showLanding && !showLogin) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // Mostrar página de login
  if (!user && showLogin) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Se não estiver autenticado mas não está em landing nem login, mostrar landing
  if (!user) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }
  
  return (
    <div className="min-h-screen bg-[#222] font-comic relative">
      <Navbar 
         activeTab={activeTab} 
         onTabChange={setActiveTab} 
         credits={credits} 
         isGenerating={isGenerating} 
         user={user}
         onLogout={handleLogout}
      />
      
      <div className="pt-20 pb-10 container mx-auto px-4 min-h-[calc(100vh-80px)]">
        
        {/* Saving Status Toast */}
        {savingStatus && (
          <div className="fixed top-20 right-4 z-[2001] max-w-md animate-in slide-in-from-right duration-300">
            <div className="bg-blue-500 border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-4">
              <div className="font-comic text-xl text-white">
                {savingStatus}
              </div>
            </div>
          </div>
        )}

        {/* Error Message Toast */}
        {errorMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] max-w-2xl w-full mx-4 animate-in slide-in-from-top duration-300">
            <div className="bg-red-100 border-[6px] border-red-600 shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 relative">
              <button
                onClick={() => setErrorMessage(null)}
                className="absolute top-2 right-2 text-red-600 hover:text-red-800 font-bold text-2xl"
              >
                ×
              </button>
              <h3 className="font-comic text-2xl text-red-800 mb-3 uppercase">Erro na Geração</h3>
              <div className="font-comic text-lg text-red-700 whitespace-pre-line">
                {errorMessage}
              </div>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://ai.google.dev/gemini-api/docs/billing"
                  target="_blank"
                  rel="noreferrer"
                  className="comic-btn bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-500"
                >
                  Ver Documentação
                </a>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="comic-btn bg-gray-600 text-white px-4 py-2 text-sm hover:bg-gray-500"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* CREATE TAB */}
        {activeTab === 'create' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Setup 
                  hero={hero}
                  heroName={heroName}
                  selectedGenre={selectedGenre}
                  customPremise={customPremise}
                  comicType={comicType}
                  seriesTitle={seriesTitle}
                  seriesParts={seriesParts}
                  credits={credits}
                  onHeroUpload={(f) => {
                     fileToBase64(f).then(b64 => setHero({ base64: b64, desc: "Hero" }));
                  }}
                  onHeroNameChange={setHeroName}
                  onGenreChange={setSelectedGenre}
                  onPremiseChange={setCustomPremise}
                  onComicTypeChange={setComicType}
                  onSeriesTitleChange={setSeriesTitle}
                  onSeriesPartsChange={setSeriesParts}
                  onLaunch={launchStory}
                  isGenerating={isGenerating}
                />
             </div>
        )}

        {/* READ TAB - The Result View */}
        {activeTab === 'read' && (
            <div className="flex flex-col lg:flex-row items-center justify-start lg:justify-center lg:gap-24 gap-4 w-full h-full min-h-0 lg:min-h-[80vh] animate-in zoom-in duration-300 pt-4 lg:pt-0">
                {comicFaces.length === 0 ? (
                    <div className="text-white text-center opacity-50 mt-20">
                        <p className="text-4xl mb-4">Nenhum livrinho criado ainda...</p>
                        <button onClick={() => setActiveTab('create')} className="comic-btn bg-yellow-400 px-6 py-2 text-xl">CRIAR AGORA</button>
                    </div>
                ) : (
                    <>
                        {/* Wrapper for Book and Arrows */}
                        <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-6 relative w-full lg:w-auto">
                            {/* LEFT ARROW (Desktop only) */}
                            <button 
                                onClick={prevPage}
                                disabled={currentSheetIndex === 0}
                                className="hidden lg:flex w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] items-center justify-center hover:translate-y-1 hover:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed z-20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            {/* The Book Container */}
                            <div className="comic-scene">
                                <Book 
                                    comicFaces={comicFaces}
                                    currentSheetIndex={currentSheetIndex}
                                    isStarted={true}
                                    isSetupVisible={false}
                                    onSheetClick={() => {}} // Disable click on pages
                                    onChoice={() => {}}
                                    onOpenBook={() => {}}
                                    onDownload={handleDownload}
                                    onReset={() => {}}
                                />
                            </div>

                            {/* RIGHT ARROW (Desktop only) */}
                            <button 
                                onClick={nextPage}
                                disabled={currentSheetIndex >= Math.ceil(TOTAL_PAGES / 2)}
                                className="hidden lg:flex w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] items-center justify-center hover:translate-y-1 hover:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed z-20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            {/* MOBILE ARROWS ROW (Mobile only) */}
                            <div className="flex lg:hidden items-center justify-center gap-6 mt-4 mb-2">
                                <button 
                                    onClick={prevPage}
                                    disabled={currentSheetIndex === 0}
                                    className="w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={nextPage}
                                    disabled={currentSheetIndex >= Math.ceil(TOTAL_PAGES / 2)}
                                    className="w-16 h-16 bg-yellow-400 border-[3px] border-black shadow-[4px_4px_0px_black] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Options Panel (Right Side Card on Desktop, Bottom on Mobile) */}
                        <div className="w-[95%] max-w-[340px] lg:w-[340px] bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-6 rotate-0 lg:rotate-1 flex flex-col items-center text-center mb-8 lg:mb-0">
                            <h3 className="font-comic text-3xl text-black border-b-4 border-black w-full pb-2 mb-4">OPÇÕES</h3>
                            
                            <div className="flex flex-col items-center mb-6 w-full min-h-[100px] justify-center">
                                {isActuallyGenerating ? (
                                    <>
                                        <div className="text-4xl mb-2 animate-bounce">⏳</div>
                                        <p className="font-comic text-sm text-gray-600 leading-tight uppercase">
                                            SEU GIBI ESTÁ SENDO GERADO.<br/>
                                            AGUARDE ATÉ QUE TODAS AS PÁGINAS ESTEJAM PRONTAS.
                                        </p>
                                    </>
                                ) : isGenerationComplete() ? (
                                    <div className="py-4">
                                        <p className="font-comic text-xl text-green-600 animate-pulse">✓ EDIÇÃO COMPLETA!</p>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <p className="font-comic text-sm text-gray-600">Aguardando início da geração...</p>
                                    </div>
                                )}
                            </div>

                            <div className="w-full flex flex-col gap-4">
                                {/* Progress Button */}
                                <div 
                                    className="w-full py-3 border-4 border-black font-comic text-xl uppercase shadow-[0px_4px_0px_#000] flex items-center justify-center transition-colors duration-500"
                                    style={{
                                        backgroundColor: `hsl(${45 - (generatedPagesCount / MAX_STORY_PAGES) * 45}, 100%, 50%)`,
                                        color: 'white',
                                        textShadow: '2px 2px 0px black'
                                    }}
                                >
                                    {generatedPagesCount} / {MAX_STORY_PAGES} PÁGINAS
                                </div>

                                <button 
                                    onClick={handleDownload}
                                    disabled={isActuallyGenerating || !isGenerationComplete()}
                                    className={`w-full py-3 border-4 font-comic text-xl uppercase transition-all ${
                                        isActuallyGenerating || !isGenerationComplete()
                                        ? 'bg-[#cdcdcd] border-[#999] text-gray-500 shadow-[0px_4px_0px_#999] cursor-not-allowed'
                                        : 'bg-blue-500 border-black text-white hover:bg-blue-400 shadow-[0px_4px_0px_#000] active:translate-y-1 active:shadow-none'
                                    }`}
                                >
                                    BAIXAR PDF
                                </button>

                                <button 
                                    onClick={() => {
                                        setComicFaces([]);
                                        setHero(null);
                                        setActiveTab('create');
                                    }}
                                    disabled={isGenerating}
                                    className={`w-full py-3 border-4 font-comic text-xl uppercase transition-all ${
                                        isGenerating 
                                        ? 'bg-[#cdcdcd] border-[#999] text-gray-500 shadow-[0px_4px_0px_#999] cursor-not-allowed'
                                        : 'bg-yellow-400 border-black text-black hover:bg-yellow-300 shadow-[0px_4px_0px_#000] active:translate-y-1 active:shadow-none'
                                    }`}
                                >
                                    CRIAR NOVA EDIÇÃO
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
            <Gallery
              userId={user?.id}
              onSelectComic={(comic) => {
                // Se tem PDF, abrir diretamente
                if (comic.pdf_url) {
                  window.open(comic.pdf_url, '_blank');
                } else if (comic.comic_data?.comicFaces) {
                  // Fallback para gibis antigos com imagens
                  setComicFaces(comic.comic_data.comicFaces);
                  setHeroName(comic.hero_name);
                  setSelectedGenre(comic.genre);
                  setStoryTone(comic.story_tone);
                  setCurrentSheetIndex(0);
                  setActiveTab('read');
                }
              }}
              onDeleteComic={(id) => {
                // Atualizar contador de gibis
                setTotalComics(prev => Math.max(0, prev - 1));
                // Se o gibi deletado é o que está sendo visualizado, limpar
                if (comicFaces.length > 0) {
                  setComicFaces([]);
                  setHeroName('');
                  if (activeTab === 'read') {
                    setActiveTab('gallery');
                  }
                }
              }}
            />
        )}
        
         {/* PROFILE TAB */}
         {activeTab === 'profile' && (
            <ProfileTab 
              user={user}
              credits={credits}
              totalComics={totalComics}
              onLogout={handleLogout}
              onCreditsUpdate={async () => {
                // Recarregar créditos do perfil
                if (user) {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits')
                    .eq('id', user.id)
                    .single();
                  if (profile) {
                    setCredits(profile.credits);
                  }
                }
              }}
            />
        )}

      </div>

      {/* Footer Admin Toggle */}
      <div className="fixed bottom-2 left-2 z-[2000] opacity-50 hover:opacity-100 transition-opacity">
          <button onClick={() => setShowAdmin(true)} className="text-[10px] text-gray-600 bg-white/20 px-2 rounded">Admin</button>
      </div>

      {/* Dialogs */}
      {showApiKeyDialog && <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />}
      {showAdmin && <AdminPage stats={tokenStats} onClose={() => setShowAdmin(false)} onReset={() => setTokenStats({input:0, output:0, totalRequests:0, model: MODEL_V3})} />}
    
    </div>
  );
};

export default App;
