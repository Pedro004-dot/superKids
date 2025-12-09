<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/17zZLCPD-mbHHULC6Alx21pSWtNTRNRRi

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with your credentials:
   ```bash
   # Google Gemini API Key
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

   **⚠️ IMPORTANTE - Como obter as credenciais Supabase:**
   
   a. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
   
   b. Vá em **Settings → API**
   
   c. Copie:
      - **URL**: Sua URL do projeto (ex: `https://xxx.supabase.co`)
      - **Anon Key**: A chave pública anon (formato longo JWT que começa com `eyJ...`)
   
   **⚠️ NÃO use a Publishable Key** (formato `sb_publishable_xxx`). Use a **Anon Key** tradicional (formato JWT longo).

3. Run the app:
   ```bash
   npm run dev
   ```
