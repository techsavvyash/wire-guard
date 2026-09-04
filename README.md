# Wire Grid

Development-only visual editing tools for React applications.

Next.js applications use the Next adapter:

```ts
import { withWireGrid } from "@techsavvyash/wire-grid-next"

export default withWireGrid({})
```

React applications built with Vite use the Vite plugin and render the shared
overlay once near the application root:

```ts
// vite.config.ts
import { wireGrid } from "@techsavvyash/wire-grid-vite"

export default { plugins: [wireGrid()] }
```

```tsx
import { WireGridOverlay } from "@techsavvyash/wire-grid-runtime"

createRoot(root).render(<><App /><WireGridOverlay /></>)
```

The browser overlay can edit or delete selected JSX. Deleting a direct
conditional or `.map()` render removes its surrounding render expression;
deleting one branch of a ternary replaces only that branch with `null`.

## Documentation

- [Getting started](docs/guide/getting-started.md)
- [Next.js integration](docs/guide/next.md)
- [React + Vite integration](docs/guide/vite.md)
- [Browser editing tutorial](docs/guide/tutorial.md)
- [Recorded tutorial video](docs/public/tutorials/next-text-edit.webm)
- [Product demo video](docs/public/tutorials/wire-grid-product-demo.mp4)

See [TECHNICAL_IMPLEMENTATION.md](TECHNICAL_IMPLEMENTATION.md) for the implementation plan.
