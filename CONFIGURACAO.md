# 🔧 Configuração do Super Kids

## 📝 Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```bash
# Google Gemini API Key (para geração de histórias e imagens)
VITE_GEMINI_API_KEY=sua_api_key_aqui

# Supabase Configuration
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

---

## 🔑 Como Obter as Credenciais do Supabase

### 1. Acesse o Dashboard do Supabase
👉 [https://supabase.com/dashboard](https://supabase.com/dashboard)

### 2. Selecione seu Projeto
Clique no projeto "Super Kids" (ou o nome do seu projeto)

### 3. Vá para Settings → API
No menu lateral: **Settings** → **API**

### 4. Copie as Credenciais

#### ✅ **URL do Projeto**
- Seção: **Project URL**
- Formato: `https://xxx.supabase.co`
- Cole no `.env` como `VITE_SUPABASE_URL`

#### ✅ **Anon Key (IMPORTANTE!)**
- Seção: **Project API keys**
- Procure por: **"anon" "public"**
- **Formato correto**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (muito longo, ~200+ caracteres)
- Cole no `.env` como `VITE_SUPABASE_ANON_KEY`

---

## ⚠️ ATENÇÃO: Qual Chave Usar?

### ✅ Use a ANON KEY (Formato JWT)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3J3dG10...
```
- Formato longo (200+ caracteres)
- Começa com `eyJ`
- É um JWT completo
- **Esta é a chave correta para usar!**

### ❌ NÃO Use a Publishable Key
```
sb_publishable_imX8_j6mo43jKm1g1SnbLw_6A7GJZlM
```
- Formato curto
- Começa com `sb_publishable_`
- **NÃO funciona para Storage REST API**
- Por isso as imagens não estavam salvando!

---

## 🧪 Como Obter a Gemini API Key

1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Clique em **"Get API key"**
3. Crie ou selecione um projeto
4. Copie a API key gerada
5. Cole no `.env` como `VITE_GEMINI_API_KEY`

---

## ✅ Exemplo de .env Completo

```bash
# Google Gemini API
VITE_GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase
VITE_SUPABASE_URL=https://nxorwtmtgxvpqmrwhvdx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3J3dG10Z3h2cHFtcndodmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY3MjM0NTUsImV4cCI6MjAyMjI5OTQ1NX0.xxx...
```

---

## 🚀 Após Configurar

1. Salve o arquivo `.env`
2. Reinicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Verifique no console do navegador se aparece:
   ```
   [App] Supabase URL configurada: OK
   [App] Supabase Anon Key configurada: OK
   ```

---

## 🐛 Troubleshooting

### Erro: "Environment variable VITE_SUPABASE_URL is not defined"
- Você esqueceu de criar o arquivo `.env`
- Ou o arquivo está com nome errado (deve ser exatamente `.env`)

### Erro: "403 Unauthorized" no upload de imagens
- Você está usando a Publishable Key ao invés da Anon Key
- Verifique se copiou a chave correta (formato JWT longo)

### Erro: "Token expired"
- Isso é normal, o sistema agora faz refresh automático
- Se continuar vendo o erro, verifique se a Anon Key está correta
