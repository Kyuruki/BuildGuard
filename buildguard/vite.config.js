import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Route-level code splitting (via React Router lazy() in App.jsx) keeps the initial
  // bundle small for Core Web Vitals; Vite/Rolldown handles vendor chunking by default.
  plugins: [react(), tailwindcss()],
});
