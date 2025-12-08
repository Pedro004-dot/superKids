<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/17zZLCPD-mbHHULC6Alx21pSWtNTRNRRi

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file in the root directory with:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_SUPABASE_URL=https://nxorwtmtgxvpqmrwhvdx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_imX8_j6mo43jKm1g1SnbLw_6A7GJZlM
   ```
3. Run the app:
   `npm run dev`
