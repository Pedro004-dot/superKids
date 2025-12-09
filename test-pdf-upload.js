#!/usr/bin/env node

/**
 * Script de teste para upload de PDF no Supabase
 * 
 * Como usar:
 * 1. npm install @supabase/supabase-js
 * 2. node test-pdf-upload.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ⚠️ ATENÇÃO: Substitua com suas credenciais do .env
// Obtenha em: https://supabase.com/dashboard/project/_/settings/api
// Use a ANON KEY (formato JWT longo), NÃO a Publishable Key!
const SUPABASE_URL = 'SEU_SUPABASE_URL_AQUI';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configurações de teste
const TEST_EMAIL = `test${Date.now()}@superkids.com`;
const TEST_PASSWORD = 'superkids123';
const PDF_PATH = './SuperKids_Pedro-7.pdf';

function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
}

async function testConnection() {
    log('🔍 Testando conexão com Supabase...');
    
    try {
        const { data, error } = await supabase.from('comics').select('count', { count: 'exact' });
        
        if (error) {
            log(`❌ Erro de conexão: ${error.message}`);
            return false;
        } else {
            log('✅ Conexão com Supabase OK');
            return true;
        }
    } catch (err) {
        log(`❌ Exceção na conexão: ${err.message}`);
        return false;
    }
}

async function setupTestUser() {
    log('👤 Configurando usuário de teste...');
    
    try {
        // Tentar fazer login primeiro
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        if (loginData.user) {
            log(`✅ Login bem-sucedido: ${loginData.user.id}`);
            return loginData.user;
        }
        
        // Se login falhou, tentar cadastrar
        log('📝 Usuário não existe, criando conta...');
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        if (signupError) {
            log(`❌ Erro no cadastro: ${signupError.message}`);
            return null;
        }
        
        if (signupData.user) {
            log(`✅ Cadastro bem-sucedido: ${signupData.user.id}`);
            return signupData.user;
        }
        
        log('❌ Falha ao criar usuário');
        return null;
        
    } catch (err) {
        log(`❌ Exceção na autenticação: ${err.message}`);
        return null;
    }
}

async function testSimpleSave(user) {
    log('💾 Testando salvamento simples...');
    
    try {
        const payload = {
            user_id: user.id,
            hero_name: 'Pedro Teste Script',
            genre: 'Teste Node.js',
            story_tone: 'EMPOLGANTE',
            total_pages: 1,
            comic_data: { 
                test: true, 
                timestamp: new Date().toISOString(),
                script: 'node.js'
            }
        };
        
        log(`📊 Payload: ${JSON.stringify(payload).length} bytes`);
        
        const { data, error } = await supabase
            .from('comics')
            .insert(payload)
            .select()
            .single();
        
        if (error) {
            log(`❌ Erro no salvamento: ${error.message}`);
            log(`📊 Detalhes: ${JSON.stringify(error, null, 2)}`);
            return null;
        } else {
            log(`✅ Salvamento bem-sucedido: ${data.id}`);
            return data;
        }
    } catch (err) {
        log(`❌ Exceção no salvamento: ${err.message}`);
        return null;
    }
}

async function testPDFUpload(user) {
    log('📄 Testando upload de PDF...');
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(PDF_PATH)) {
        log(`❌ Arquivo PDF não encontrado: ${PDF_PATH}`);
        return null;
    }
    
    try {
        // Ler o arquivo
        const pdfBuffer = fs.readFileSync(PDF_PATH);
        const fileSize = (pdfBuffer.length / 1024 / 1024).toFixed(2);
        log(`📊 Arquivo carregado: ${fileSize} MB`);
        
        // Upload para storage
        const fileName = `test-${Date.now()}-SuperKids_Pedro.pdf`;
        const filePath = `${user.id}/pdfs/${fileName}`;
        
        log(`📤 Fazendo upload para: ${filePath}`);
        
        const { data, error } = await supabase.storage
            .from('comics-images')
            .upload(filePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });
        
        if (error) {
            log(`❌ Erro no upload: ${error.message}`);
            log(`📊 Detalhes: ${JSON.stringify(error, null, 2)}`);
            return null;
        } else {
            // Obter URL pública
            const { data: urlData } = supabase.storage
                .from('comics-images')
                .getPublicUrl(filePath);
            
            log(`✅ Upload bem-sucedido!`);
            log(`🔗 URL: ${urlData.publicUrl}`);
            return urlData.publicUrl;
        }
    } catch (err) {
        log(`❌ Exceção no upload: ${err.message}`);
        return null;
    }
}

async function testComplexSave(user, pdfUrl) {
    log('💾 Testando salvamento complexo com PDF...');
    
    try {
        // Simular dados complexos como no app real
        const complexData = {
            heroName: 'Pedro Script',
            selectedGenre: 'Aventura',
            storyTone: 'EMPOLGANTE',
            createdAt: new Date().toISOString(),
            totalPages: 12,
            pdfUrl: pdfUrl,
            // Simular dados grandes
            metadata: {
                generated_by: 'test-script',
                test_data: Array(100).fill('test').join(''),
                timestamp: Date.now()
            }
        };
        
        const payload = {
            user_id: user.id,
            hero_name: 'Pedro Script Complexo',
            genre: 'Aventura',
            story_tone: 'EMPOLGANTE',
            total_pages: 12,
            pdf_url: pdfUrl,
            comic_data: complexData,
            series_id: null,
            part_number: null,
            is_series_part: false
        };
        
        log(`📊 Payload complexo: ${JSON.stringify(payload).length} bytes`);
        
        const { data, error } = await supabase
            .from('comics')
            .insert(payload)
            .select()
            .single();
        
        if (error) {
            log(`❌ Erro no salvamento complexo: ${error.message}`);
            log(`📊 Detalhes: ${JSON.stringify(error, null, 2)}`);
            return null;
        } else {
            log(`✅ Salvamento complexo bem-sucedido: ${data.id}`);
            return data;
        }
    } catch (err) {
        log(`❌ Exceção no salvamento complexo: ${err.message}`);
        return null;
    }
}

async function listComics() {
    log('📋 Listando comics salvos...');
    
    try {
        const { data, error } = await supabase
            .from('comics')
            .select('id, hero_name, genre, created_at, total_pages, pdf_url')
            .order('created_at', { ascending: false });
        
        if (error) {
            log(`❌ Erro ao listar: ${error.message}`);
            return;
        }
        
        log(`✅ Comics encontrados: ${data.length}`);
        data.forEach((comic, index) => {
            const pdfStatus = comic.pdf_url ? '📄 PDF' : '❌ Sem PDF';
            log(`  ${index + 1}. ${comic.hero_name} (${comic.genre}) - ${comic.total_pages} páginas ${pdfStatus}`);
        });
        
    } catch (err) {
        log(`❌ Exceção ao listar: ${err.message}`);
    }
}

async function runTests() {
    log('🚀 Iniciando testes do Supabase...');
    log('=' .repeat(50));
    
    // Teste 1: Conexão
    const connected = await testConnection();
    if (!connected) {
        log('❌ Falha na conexão. Abortando testes.');
        return;
    }
    
    // Teste 2: Autenticação
    const user = await setupTestUser();
    if (!user) {
        log('❌ Falha na autenticação. Abortando testes.');
        return;
    }
    
    // Teste 3: Salvamento simples
    const simpleComic = await testSimpleSave(user);
    if (!simpleComic) {
        log('❌ Falha no salvamento simples.');
    }
    
    // Teste 4: Upload de PDF
    const pdfUrl = await testPDFUpload(user);
    if (!pdfUrl) {
        log('❌ Falha no upload de PDF.');
    }
    
    // Teste 5: Salvamento complexo
    if (pdfUrl) {
        const complexComic = await testComplexSave(user, pdfUrl);
        if (!complexComic) {
            log('❌ Falha no salvamento complexo.');
        }
    }
    
    // Teste 6: Listagem
    await listComics();
    
    log('=' .repeat(50));
    log('🏁 Testes concluídos!');
    log('');
    log('📋 Resumo:');
    log(`✅ Conexão: ${connected ? 'OK' : 'FALHA'}`);
    log(`✅ Autenticação: ${user ? 'OK' : 'FALHA'}`);
    log(`✅ Salvamento simples: ${simpleComic ? 'OK' : 'FALHA'}`);
    log(`✅ Upload PDF: ${pdfUrl ? 'OK' : 'FALHA'}`);
    log(`✅ Salvamento complexo: ${pdfUrl ? 'OK' : 'FALHA'}`);
    
    if (connected && user && simpleComic) {
        log('');
        log('🎉 Supabase está funcionando corretamente!');
        log('   O problema pode estar no código do app React.');
    } else {
        log('');
        log('🚨 Problemas identificados no Supabase.');
        log('   Verifique as credenciais e configurações.');
    }
}

// Executar testes
runTests().catch(err => {
    log(`💥 Erro fatal: ${err.message}`);
    process.exit(1);
});
