import { defineConfig } from "vitepress"

export default defineConfig({
  title: "Wire Grid",
  description: "Development-only browser editing for React source code.",
  cleanUrls: true,
  head: [["link", { rel: "icon", href: "/wire-grid-mark.svg", type: "image/svg+xml" }]],
  themeConfig: {
    logo: "/wire-grid-mark.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Tutorial", link: "/guide/tutorial" }
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Next.js Integration", link: "/guide/next" },
          { text: "React + Vite Integration", link: "/guide/vite" },
          { text: "Adapter Foundation", link: "/guide/adapters" },
          { text: "Browser Editing Tutorial", link: "/guide/tutorial" },
          { text: "Release Workflow", link: "/guide/releases" }
        ]
      },
      { text: "Reference", items: [{ text: "Releases", link: "/guide/releases" }] }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/techsavvyash/wire-guard" }
    ],
    search: {
      provider: "local"
    }
  }
})
