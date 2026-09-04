import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { WireGridOverlay } from "@techsavvyash/wire-grid-runtime"

import { App } from "./App"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <WireGridOverlay />
  </StrictMode>
)
