import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const stamp = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export default defineConfig({ plugins: [react()], define: { __BUILD__: JSON.stringify(stamp) } });
