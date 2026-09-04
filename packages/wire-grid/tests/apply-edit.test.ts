import { describe, expect, it } from "vitest"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  applyClassTokenReplaceEdit,
  applyInlineStyleEdit,
  applyJsxAttributeStringEdit,
  applyJsxDeleteEdit,
  applyJsxTextEdit,
  previewEdit
} from "../src/edit/apply-edit.js"

describe("applyJsxTextEdit", () => {
  it("deletes an ordinary JSX child", () => {
    const result = applyJsxDeleteEdit(
      `export function Page() {
  return <main><section data-wg-id="target">Remove me</section><p>Keep me</p></main>
}
`,
      {
        source: { file: "src/Page.tsx", id: "target" },
        edit: { kind: "jsx-delete" }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).not.toContain("Remove me")
    expect(result.ok && result.code).toContain("Keep me")
  })

  it("removes a logical conditional when deleting its rendered element", () => {
    const result = applyJsxDeleteEdit(
      `export function Page({ visible }) {
  return <main>{visible && <aside data-wg-id="target">Conditional</aside>}<p>Keep me</p></main>
}
`,
      {
        source: { file: "src/Page.tsx", id: "target" },
        edit: { kind: "jsx-delete" }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).not.toContain("visible &&")
    expect(result.ok && result.code).not.toContain("Conditional")
    expect(result.ok && result.code).toContain("Keep me")
  })

  it("replaces only the selected ternary branch with null", () => {
    const result = applyJsxDeleteEdit(
      `export function Page({ ready }) {
  return <main>{ready ? <p data-wg-id="target">Ready</p> : <p>Waiting</p>}</main>
}
`,
      {
        source: { file: "src/Page.tsx", id: "target" },
        edit: { kind: "jsx-delete" }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain("ready ? null : <p>Waiting</p>")
  })

  it("removes a filtered map expression when deleting its direct template", () => {
    const result = applyJsxDeleteEdit(
      `export function Page({ items }) {
  return <main>{items.filter((item) => item.visible).map((item) => <article data-wg-id="target" key={item.id}>{item.label}</article>)}</main>
}
`,
      {
        source: { file: "src/Page.tsx", id: "target" },
        edit: { kind: "jsx-delete" }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).not.toContain(".filter(")
    expect(result.ok && result.code).not.toContain(".map(")
  })

  it("keeps a map wrapper when deleting a nested child", () => {
    const result = applyJsxDeleteEdit(
      `export function Page({ items }) {
  return <main>{items.map((item) => <article key={item.id}><span data-wg-id="target">Badge</span><b>{item.label}</b></article>)}</main>
}
`,
      {
        source: { file: "src/Page.tsx", id: "target" },
        edit: { kind: "jsx-delete" }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain("items.map")
    expect(result.ok && result.code).not.toContain("Badge")
    expect(result.ok && result.code).toContain("item.label")
  })

  it("updates JSX text for the matching Wire Grid id", () => {
    const result = applyJsxTextEdit(
      `export default function Page() {
  return <h1 data-wg-id="title">Old title</h1>
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "title"
        },
        edit: {
          kind: "jsx-text",
          value: "New title"
        }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain(">New title<")
  })

  it("updates multiline JSX text", () => {
    const result = applyJsxTextEdit(
      `export default function Page() {
  return (
    <h1 data-wg-id="title">
      Old title
    </h1>
  )
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "title"
        },
        edit: {
          kind: "jsx-text",
          value: "New title"
        }
      }
    )

    expect(result.ok && result.code).toContain("New title")
  })

  it("updates custom component text children by Wire Grid id", () => {
    const result = applyJsxTextEdit(
      `export default function Page() {
  return <CardTitle data-wg-id="title">Old title</CardTitle>
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "title"
        },
        edit: {
          kind: "jsx-text",
          value: "New title"
        }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain(">New title<")
  })

  it("updates custom component string props by Wire Grid id", () => {
    const result = applyJsxAttributeStringEdit(
      `export default function Page() {
  return <Callout data-wg-id="callout" heading="Old heading" />
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "callout"
        },
        edit: {
          kind: "jsx-attribute-string",
          name: "heading",
          value: "New heading"
        }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain(`heading="New heading"`)
  })

  it("rejects expression props", () => {
    const result = applyJsxAttributeStringEdit(
      `export default function Page() {
  return <Callout data-wg-id="callout" heading={title} />
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "callout"
        },
        edit: {
          kind: "jsx-attribute-string",
          name: "heading",
          value: "New heading"
        }
      }
    )

    expect(result).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_NODE"
    })
  })

  it("updates existing inline style properties", () => {
    const result = applyInlineStyleEdit(
      `export default function Page() {
  return <h1 data-wg-id="title" style={{ color: "#111827" }}>Hello</h1>
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "title"
        },
        edit: {
          kind: "inline-style-set",
          property: "color",
          value: "#2563eb"
        }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain(`color: "#2563eb"`)
  })

  it("adds missing inline style properties to existing style objects", () => {
    const result = applyInlineStyleEdit(
      `export default function Page() {
  return <h1 data-wg-id="title" style={{ fontWeight: 700 }}>Hello</h1>
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "title"
        },
        edit: {
          kind: "inline-style-set",
          property: "color",
          value: "#2563eb"
        }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain(`color: "#2563eb"`)
  })

  it("replaces simple className tokens", () => {
    const result = applyClassTokenReplaceEdit(
      `export default function Page() {
  return <p data-wg-id="lede" className="text-red-500 font-bold">Hello</p>
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "lede"
        },
        edit: {
          kind: "class-token-replace",
          from: "text-red-500",
          to: "text-blue-500"
        }
      }
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain(
      `className="text-blue-500 font-bold"`
    )
  })

  it("rejects dynamic className expressions", () => {
    const result = applyClassTokenReplaceEdit(
      `export default function Page() {
  return <p data-wg-id="lede" className={className}>Hello</p>
}
`,
      {
        source: {
          file: "app/page.tsx",
          id: "lede"
        },
        edit: {
          kind: "class-token-replace",
          from: "text-red-500",
          to: "text-blue-500"
        }
      }
    )

    expect(result).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_NODE"
    })
  })




  it("rejects missing source ids", () => {
    const result = applyJsxTextEdit(`<h1>Old title</h1>`, {
      source: {
        file: "app/page.tsx"
      },
      edit: {
        kind: "jsx-text",
        value: "New title"
      }
    })

    expect(result).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_NODE"
    })
  })

  it("previews edits without writing to disk", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "wire-grid-preview-"))
    const filePath = path.join(rootDir, "page.tsx")
    const source = `export default function Page() {
  return <h1 data-wg-id="title">Old title</h1>
}
`

    try {
      await writeFile(filePath, source)

      const result = await previewEdit({
        rootDir,
        request: {
          source: {
            file: "page.tsx",
            id: "title"
          },
          edit: {
            kind: "jsx-text",
            value: "Preview title"
          },
          preview: true
        }
      })

      expect(result).toMatchObject({
        ok: true,
        changed: true,
        preview: true
      })
      expect(result.ok && result.diff).toContain("-   return <h1")
      expect(result.ok && result.diff).toContain("+   return <h1")
      await expect(readFile(filePath, "utf8")).resolves.toBe(source)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
