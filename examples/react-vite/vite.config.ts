import react from "@vitejs/plugin-react"
import { wireGrid } from "@techsavvyash/wire-grid-vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [wireGrid(), react()]
})
