import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are baked in at build time
// from .env.production (committed — anon key is public-safe by design).
// For local dev, copy .env.example → .env and fill in your keys.

export default defineConfig({
  plugins: [react(), cloudflare()],
  base: "/",
});