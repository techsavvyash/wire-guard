# React + Vite

Install the Vite adapter and runtime alongside React and Vite:

```sh
pnpm add -D @techsavvyash/wire-grid-vite
pnpm add @techsavvyash/wire-grid-runtime
```

Add Wire Grid before the React plugin so source metadata is attached before
the JSX transform:

```ts
import react from "@vitejs/plugin-react"
import { wireGrid } from "@techsavvyash/wire-grid-vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [wireGrid(), react()]
})
```

Render the development overlay once at the application root:

```tsx
import { WireGridOverlay } from "@techsavvyash/wire-grid-runtime"

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <WireGridOverlay />
  </>
)
```

The plugin only runs in Vite's development server. Production builds do not
receive source metadata or the edit endpoint, and the overlay returns `null`
in production.

For a monorepo such as Crest, set `rootDir` to the common frontend workspace
root so components imported from shared UI packages remain inside the allowed
editing boundary:

```ts
import { fileURLToPath } from "node:url"

wireGrid({ rootDir: fileURLToPath(new URL("../..", import.meta.url)) })
```

## Delete behavior

- A normal JSX child is removed from its parent's children.
- Deleting the rendered side of `condition && <Component />` removes the whole
  conditional expression.
- Deleting a direct `.map(item => <Component />)` template removes the entire
  mapped render, including a preceding `.filter(...)` chain.
- Deleting a nested child inside a mapped wrapper preserves the map and its
  siblings.
- A selected ternary branch is replaced with `null`, preserving the other
  branch.

Every DOM instance produced by a map points to the same source template.
Deleting any one of those instances therefore deletes the shared template,
not a single data record.
