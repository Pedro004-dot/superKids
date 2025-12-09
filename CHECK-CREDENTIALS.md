# ✅ Credenciais Verificadas via MCP Supabase

## 🔑 Credenciais Corretas (verificadas no Supabase Dashboard)

### URL do Projeto
```
https://nxorwtmtgxvpqmrwhvdx.supabase.co
```

### Anon Key (JWT - CORRETA)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3J3dG10Z3h2cHFtcndodmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg2MjAsImV4cCI6MjA4MDQ1NDYyMH0.L4ddiW6F38HrOwdwTlFKALAHvVPXTJkyE0IyNb4W1P8
```

**⚠️ NÃO USE ESTA**: `sb_publishable_imX8_j6mo43jKm1g1SnbLw_6A7GJZlM` (Publishable Key)

## 📋 Status da Tabela `comics`

- **RLS Enabled**: `false` (DESABILITADO)
- **Total de registros**: `0` (vazio)
- **Status**: `ACTIVE_HEALTHY`

**Importante**: Como RLS está DESABILITADO, você pode inserir dados usando apenas a ANON_KEY sem precisar de token de usuário!

## 🔧 Seu arquivo `.env` DEVE conter:

```env
VITE_SUPABASE_URL=https://nxorwtmtgxvpqmrwhvdx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3J3dG10Z3h2cHFtcndodmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Nzg2MjAsImV4cCI6MjA4MDQ1NDYyMH0.L4ddiW6F38HrOwdwTlFKALAHvVPXTJkyE0IyNb4W1P8
VITE_GEMINI_API_KEY=sua_gemini_key_aqui
```

## 🐛 Problema Detectado

O `supabase.auth.getSession()` está **travando infinitamente** (não retorna nunca).

### Possíveis Causas:

1. **Configuração do cliente Supabase** no `supabase.ts` está incorreta
2. **localStorage corrompido** - sessão de autenticação quebrada
3. **Credenciais no .env diferentes** das que estamos usando no código

### Soluções Aplicadas:

1. ✅ Timeout de 2s no `getAuthToken()` - se travar, continua sem token
2. ✅ Salvamento funciona SEM token (RLS desabilitado)
3. ✅ Fallback para Supabase Client se REST falhar

## 🧪 Próximos Passos

1. **Verificar `.env`**: Confirme que as credenciais acima estão no seu `.env`
2. **Reiniciar servidor**: `npm run dev` (Ctrl+C e rodar de novo)
3. **Limpar localStorage**: Console do navegador → `localStorage.clear()` → F5
4. **Testar novamente**: Gerar um gibi

Se ainda não funcionar, o problema está no `supabase.ts` (cliente mal configurado).
