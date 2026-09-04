import { describe, expect, it } from "vitest"

import { instrumentSource } from "../src/instrumentation/instrument-source.js"

describe("instrumentSource", () => {
  it("adds deletion metadata to native JSX elements without editable text", () => {
    const code = `export function Page() {
  return <div><img alt="Demo" /></div>
}
`

    const result = instrumentSource({
      code,
      filePath: "/repo/app/src/Page.tsx",
      rootDir: "/repo/app"
    })

    expect(result).toContain(`data-wg-file="src/Page.tsx"`)
    expect(result).toContain(`data-wg-kind="jsx-element"`)
    expect(result.match(/data-wg-id=/g)).toHaveLength(2)
  })

  it("adds Wire Grid metadata to native JSX elements with text", () => {
    const code = `export default function Page() {
  return <h1>Hello</h1>
}
`

    const result = instrumentSource({
      code,
      filePath: "/repo/app/app/page.tsx",
      rootDir: "/repo/app"
    })

    expect(result).toContain(`data-wg-file="app/page.tsx"`)
    expect(result).toContain(`data-wg-kind="jsx-text"`)
  })

  it("does not instrument custom components", () => {
    const code = `export function Page() {
  return <Title>Hello</Title>
}
`

    expect(
      instrumentSource({
        code,
        filePath: "/repo/app/app/page.tsx",
        rootDir: "/repo/app"
      })
    ).toBe(code)
  })

  it("instruments simple custom component text when enabled", () => {
    const code = `export function Page() {
  return <Title>Hello</Title>
}
`

    const result = instrumentSource({
      code,
      filePath: "/repo/app/app/page.tsx",
      includeCustomComponents: true,
      rootDir: "/repo/app"
    })

    expect(result).toContain(`data-wg-file="app/page.tsx"`)
    expect(result).toContain(`data-wg-kind="jsx-component-text"`)
  })

  it("instruments one configured string prop on custom components", () => {
    const code = `export function Page() {
  return <Callout heading="Prop title" />
}
`

    const result = instrumentSource({
      code,
      filePath: "/repo/app/app/page.tsx",
      includeCustomComponentProps: true,
      rootDir: "/repo/app"
    })

    expect(result).toContain(`data-wg-kind="jsx-prop-text"`)
    expect(result).toContain(`data-wg-prop="heading"`)
  })

  it("adds editable style metadata to native elements with style objects", () => {
    const code = `export function Page() {
  return <h1 style={{ color: "#111827" }}>Hello</h1>
}
`

    const result = instrumentSource({
      code,
      filePath: "/repo/app/app/page.tsx",
      rootDir: "/repo/app"
    })

    expect(result).toContain(`data-wg-kind="jsx-text"`)
    expect(result).toContain(`data-wg-style-props="color"`)
  })

  it("adds editable class token metadata to native elements", () => {
    const code = `export function Page() {
  return <p className="text-red-500 font-bold">Hello</p>
}
`

    const result = instrumentSource({
      code,
      filePath: "/repo/app/app/page.tsx",
      rootDir: "/repo/app"
    })

    expect(result).toContain(`data-wg-class-tokens="text-red-500"`)
  })
})
