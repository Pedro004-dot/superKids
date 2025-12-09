# 🧪 Scripts de Teste - Supabase Super Kids

Este diretório contém scripts para testar e diagnosticar problemas com o Supabase.

## 📁 Arquivos de Teste

### 1. `test-supabase.html` - Interface Web de Teste
Interface visual completa para testar todas as funcionalidades do Supabase.

**Como usar:**
1. Abra o arquivo `test-supabase.html` no navegador
2. Teste cada funcionalidade na ordem:
   - Conexão
   - Autenticação (login/cadastro)
   - Upload de PDF
   - Salvamento simples
   - Salvamento complexo
   - Listagem de comics

### 2. `test-pdf-upload.js` - Script Node.js
Script automatizado para testar upload do PDF específico.

**Como usar:**
```bash
# Instalar dependências
npm install @supabase/supabase-js

# Executar teste
node test-pdf-upload.js
```

## 🎯 Objetivos dos Testes

### ✅ O que os testes verificam:

1. **Conexão com Supabase**
   - Conectividade básica
   - Acesso à tabela `comics`

2. **Autenticação**
   - Login/cadastro de usuário
   - Verificação de sessão
   - RLS (Row Level Security)

3. **Upload de Arquivos**
   - Upload para Supabase Storage
   - Geração de URLs públicas
   - Tratamento de arquivos grandes

4. **Salvamento no Banco**
   - Insert simples (payload pequeno)
   - Insert complexo (payload grande)
   - Verificação de RLS policies

5. **Listagem de Dados**
   - Select com filtros
   - Ordenação por data

## 🔍 Diagnóstico de Problemas

### Problema: "Não salva no banco"

**Possíveis causas identificadas pelos testes:**

1. **❌ Erro de Conexão**
   ```
   Sintoma: Teste de conexão falha
   Solução: Verificar credenciais do Supabase
   ```

2. **❌ Erro de Autenticação**
   ```
   Sintoma: Login falha ou RLS bloqueia
   Solução: Verificar políticas RLS da tabela comics
   ```

3. **❌ Erro de Payload**
   ```
   Sintoma: Salvamento simples OK, complexo falha
   Solução: Reduzir tamanho dos dados ou otimizar estrutura
   ```

4. **❌ Erro de Storage**
   ```
   Sintoma: Upload de PDF falha
   Solução: Verificar bucket 'comics-images' e políticas
   ```

5. **❌ Erro de Timeout**
   ```
   Sintoma: Processo trava sem erro
   Solução: Implementar timeout e retry
   ```

## 📊 Interpretação dos Resultados

### ✅ Cenário Ideal (Tudo Funcionando):
```
✅ Conexão: OK
✅ Autenticação: OK  
✅ Salvamento simples: OK
✅ Upload PDF: OK
✅ Salvamento complexo: OK
```
**Diagnóstico:** Supabase OK, problema no código React

### ⚠️ Cenário Parcial:
```
✅ Conexão: OK
✅ Autenticação: OK
✅ Salvamento simples: OK
❌ Upload PDF: FALHA
❌ Salvamento complexo: FALHA
```
**Diagnóstico:** Problema com arquivos grandes ou storage

### ❌ Cenário Crítico:
```
✅ Conexão: OK
❌ Autenticação: FALHA
❌ Salvamento simples: FALHA
❌ Upload PDF: FALHA
❌ Salvamento complexo: FALHA
```
**Diagnóstico:** Problema de RLS ou credenciais

## 🛠️ Soluções Comuns

### 1. Problema de RLS
```sql
-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'comics';

-- Desabilitar temporariamente (CUIDADO!)
ALTER TABLE comics DISABLE ROW LEVEL SECURITY;
```

### 2. Problema de Storage
```sql
-- Verificar bucket
SELECT * FROM storage.buckets WHERE id = 'comics-images';

-- Verificar políticas de storage
SELECT * FROM pg_policies WHERE tablename = 'objects';
```

### 3. Problema de Payload
- Reduzir tamanho das imagens base64
- Usar URLs ao invés de base64
- Dividir dados em múltiplas tabelas

## 📝 Logs Importantes

Os testes geram logs detalhados. Procure por:

- `❌ Erro de conexão` → Problema de rede/credenciais
- `❌ Erro de login` → Problema de autenticação
- `❌ Erro no salvamento` → Problema de RLS/estrutura
- `❌ Erro no upload` → Problema de storage
- `Timeout` → Problema de performance

## 🚀 Próximos Passos

1. **Execute os testes** para identificar o problema específico
2. **Analise os logs** para entender a causa raiz
3. **Aplique a solução** baseada no diagnóstico
4. **Teste novamente** para confirmar a correção
5. **Atualize o código React** com a correção

---

**💡 Dica:** Execute primeiro o `test-supabase.html` no navegador para uma visão visual completa, depois use o `test-pdf-upload.js` para testes automatizados específicos.
