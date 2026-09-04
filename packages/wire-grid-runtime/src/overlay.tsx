"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

export interface WireGridOverlayProps {
  enabled?: boolean
  editEndpoint?: string
}

interface SelectionState {
  element: Element
  rect: DOMRect
  source: {
    column?: number
    classTokens: string[]
    file: string
    id: string
    kind?: string
    line?: number
    prop?: string
    styleProps: string[]
  }
}

export function WireGridOverlay({
  editEndpoint = "/__wire-grid/edit",
  enabled = true
}: WireGridOverlayProps) {
  const [active, setActive] = useState(false)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [colorValue, setColorValue] = useState("#111827")
  const [classTokenValue, setClassTokenValue] = useState("")
  const [undoAvailable, setUndoAvailable] = useState(false)
  const [value, setValue] = useState("")
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!active) {
      setHoverRect(null)
      return
    }

    function handlePointerMove(event: PointerEvent) {
      const target = getEditableTarget(event.target)

      setHoverRect(target?.getBoundingClientRect() ?? null)
    }

    function handleClick(event: MouseEvent) {
      const target = getEditableTarget(event.target)

      if (!target) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const source = readSource(target)

      if (!source) {
        return
      }

      setSelection({
        element: target,
        rect: target.getBoundingClientRect(),
        source
      })
      setColorValue(rgbToHex(window.getComputedStyle(target).color) ?? "#111827")
      setClassTokenValue(getDefaultClassToken(source.classTokens) ?? "")
      setValue(target.textContent?.trim() ?? "")
      setStatus("")
    }

    window.addEventListener("pointermove", handlePointerMove, true)
    window.addEventListener("click", handleClick, true)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true)
      window.removeEventListener("click", handleClick, true)
    }
  }, [active])

  if (!enabled || process.env.NODE_ENV === "production") {
    return null
  }

  return (
    <>
      {hoverRect ? <SelectionBox rect={hoverRect} /> : null}
      {selection ? (
        <EditPopover
          editEndpoint={editEndpoint}
          selection={selection}
          setStatus={setStatus}
          setColorValue={setColorValue}
          setClassTokenValue={setClassTokenValue}
          setValue={setValue}
          status={status}
          colorValue={colorValue}
          classTokenValue={classTokenValue}
          setUndoAvailable={setUndoAvailable}
          undoAvailable={undoAvailable}
          value={value}
        />
      ) : null}
      <div data-wire-grid-overlay style={panelStyle}>
        <span>Wire Grid</span>
        <button
          aria-pressed={active}
          onClick={() => {
            setActive((current) => !current)
            setSelection(null)
            setStatus("")
          }}
          style={buttonStyle(active)}
          type="button"
        >
          {active ? "Editing on" : "Edit"}
        </button>
      </div>
    </>
  )
}

function EditPopover({
  editEndpoint,
  selection,
  colorValue,
  classTokenValue,
  setStatus,
  setColorValue,
  setClassTokenValue,
  setUndoAvailable,
  setValue,
  status,
  undoAvailable,
  value
}: {
  editEndpoint: string
  selection: SelectionState
  colorValue: string
  classTokenValue: string
  setStatus: (status: string) => void
  setColorValue: (value: string) => void
  setClassTokenValue: (value: string) => void
  setUndoAvailable: (value: boolean) => void
  setValue: (value: string) => void
  status: string
  undoAvailable: boolean
  value: string
}) {
  const [diff, setDiff] = useState("")

  function createTextRequest(preview = false) {
    return {
      source: {
        file: selection.source.file,
        id: selection.source.id,
        line: selection.source.line,
        column: selection.source.column
      },
      edit: {
        kind:
          selection.source.kind === "jsx-prop-text"
            ? "jsx-attribute-string"
            : "jsx-text",
        name: selection.source.prop,
        value
      },
      preview
    }
  }

  function createColorRequest(preview = false) {
    return {
      source: {
        file: selection.source.file,
        id: selection.source.id,
        line: selection.source.line,
        column: selection.source.column
      },
      edit: {
        kind: "inline-style-set",
        property: "color",
        value: colorValue
      },
      preview
    }
  }

  function createClassTokenRequest(preview = false) {
    const from = selection.source.classTokens[0]

    if (!from || !classTokenValue) {
      return null
    }

    return {
      source: {
        file: selection.source.file,
        id: selection.source.id,
        line: selection.source.line,
        column: selection.source.column
      },
      edit: {
        kind: "class-token-replace",
        from,
        to: classTokenValue
      },
      preview
    }
  }

  function createDeleteRequest(preview = false) {
    return {
      source: {
        file: selection.source.file,
        id: selection.source.id,
        line: selection.source.line,
        column: selection.source.column
      },
      edit: {
        kind: "jsx-delete"
      },
      preview
    }
  }

  async function postEdit(body: unknown) {
    const response = await fetch(editEndpoint, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    })

    return (await response.json()) as {
      diff?: string
      message?: string
      ok: boolean
    }
  }

  async function previewEdit(body: unknown) {
    setStatus("Previewing")
    const result = await postEdit(body)

    if (!result.ok) {
      setDiff("")
      setStatus(result.message ?? "Preview failed")
      return
    }

    setDiff(result.diff ?? "")
    setStatus(result.diff ? "Preview ready" : "No changes")
  }

  async function saveTextEdit() {
    setStatus("Saving")

    const result = await postEdit(createTextRequest())

    if (!result.ok) {
      setStatus(result.message ?? "Save failed")
      return
    }

    selection.element.textContent = value
    setDiff("")
    setUndoAvailable(true)
    setStatus("Saved")
  }

  async function saveColorEdit() {
    setStatus("Saving")

    const result = await postEdit(createColorRequest())

    if (!result.ok) {
      setStatus(result.message ?? "Save failed")
      return
    }

    if (selection.element instanceof HTMLElement) {
      selection.element.style.color = colorValue
    }

    setDiff("")
    setUndoAvailable(true)
    setStatus("Saved")
  }

  async function saveClassTokenEdit() {
    const request = createClassTokenRequest()

    if (!request) {
      setStatus("No editable class token")
      return
    }

    setStatus("Saving")

    const result = await postEdit(request)

    if (!result.ok) {
      setStatus(result.message ?? "Save failed")
      return
    }

    selection.element.classList.replace(request.edit.from, classTokenValue)
    setDiff("")
    setUndoAvailable(true)
    setStatus("Saved")
  }

  async function deleteElement() {
    setStatus("Deleting")

    const result = await postEdit(createDeleteRequest())

    if (!result.ok) {
      setStatus(result.message ?? "Delete failed")
      return
    }

    selection.element.remove()
    setDiff("")
    setUndoAvailable(true)
    setStatus("Deleted")
  }

  async function undoLastEdit() {
    setStatus("Undoing")
    const result = await postEdit({ action: "undo" })

    if (!result.ok) {
      setStatus(result.message ?? "Undo failed")
      return
    }

    setDiff("")
    setUndoAvailable(false)
    setStatus("Undone")
    window.setTimeout(() => window.location.reload(), 100)
  }

  const top = Math.max(12, selection.rect.bottom + 8)
  const left = Math.min(
    Math.max(12, selection.rect.left),
    window.innerWidth - 340
  )

  return (
    <div data-wire-grid-overlay style={{ ...popoverStyle, left, top }}>
      {selection.source.kind !== "jsx-style" ? (
        <>
          <label style={labelStyle} htmlFor="wire-grid-text-input">
            Text
          </label>
          <input
            aria-label="Wire Grid text value"
            id="wire-grid-text-input"
            onChange={(event) => setValue(event.target.value)}
            style={inputStyle}
            value={value}
          />
        </>
      ) : null}
      {selection.source.styleProps.includes("color") ? (
        <>
          <label style={labelStyle} htmlFor="wire-grid-color-input">
            Color
          </label>
          <input
            aria-label="Wire Grid color value"
            id="wire-grid-color-input"
            onChange={(event) => setColorValue(event.target.value)}
            style={colorInputStyle}
            type="color"
            value={colorValue}
          />
        </>
      ) : null}
      {selection.source.classTokens.length > 0 ? (
        <>
          <label style={labelStyle} htmlFor="wire-grid-class-token-select">
            Class color
          </label>
          <select
            aria-label="Wire Grid class color token"
            id="wire-grid-class-token-select"
            onChange={(event) => setClassTokenValue(event.target.value)}
            style={inputStyle}
            value={classTokenValue}
          >
            {getClassTokenOptions(selection.source.classTokens[0]).map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <div style={popoverFooterStyle}>
        {selection.source.kind !== "jsx-style" ? (
          <>
            <button
              onClick={() => previewEdit(createTextRequest(true))}
              style={secondaryButtonStyle}
              type="button"
            >
              Preview
            </button>
            <button onClick={saveTextEdit} style={saveButtonStyle} type="button">
              Save
            </button>
          </>
        ) : null}
        {selection.source.styleProps.includes("color") ? (
          <>
            <button
              onClick={() => previewEdit(createColorRequest(true))}
              style={secondaryButtonStyle}
              type="button"
            >
              Preview color
            </button>
            <button onClick={saveColorEdit} style={saveButtonStyle} type="button">
              Save color
            </button>
          </>
        ) : null}
        {selection.source.classTokens.length > 0 ? (
          <>
            <button
              onClick={() => {
                const request = createClassTokenRequest(true)

                if (request) {
                  void previewEdit(request)
                }
              }}
              style={secondaryButtonStyle}
              type="button"
            >
              Preview class
            </button>
            <button
              onClick={saveClassTokenEdit}
              style={saveButtonStyle}
              type="button"
            >
              Save class
            </button>
          </>
        ) : null}
        <button
          aria-label="Delete selected component"
          onClick={deleteElement}
          style={deleteButtonStyle}
          type="button"
        >
          Delete
        </button>
        {undoAvailable ? (
          <button onClick={undoLastEdit} style={secondaryButtonStyle} type="button">
            Undo
          </button>
        ) : null}
        {status ? <span style={statusStyle}>{status}</span> : null}
      </div>
      {diff ? (
        <pre aria-label="Wire Grid diff preview" style={diffStyle}>
          {diff}
        </pre>
      ) : null}
    </div>
  )
}

function SelectionBox({ rect }: { rect: DOMRect }) {
  return (
    <div
      data-wire-grid-overlay
      style={{
        border: "2px solid #2563eb",
        height: rect.height,
        left: rect.left,
        pointerEvents: "none",
        position: "fixed",
        top: rect.top,
        width: rect.width,
        zIndex: 2147483646
      }}
    />
  )
}

function getEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  if (target.closest("[data-wire-grid-overlay]")) {
    return null
  }

  return target.closest("[data-wg-id][data-wg-file]")
}

function readSource(element: Element) {
  const file = element.getAttribute("data-wg-file")
  const classTokens = element.getAttribute("data-wg-class-tokens")
  const id = element.getAttribute("data-wg-id")
  const kind = element.getAttribute("data-wg-kind")
  const line = element.getAttribute("data-wg-line")
  const column = element.getAttribute("data-wg-column")
  const prop = element.getAttribute("data-wg-prop")
  const styleProps = element.getAttribute("data-wg-style-props")

  if (!file || !id) {
    return null
  }

  return {
    file,
    classTokens: classTokens ? classTokens.split(",").filter(Boolean) : [],
    id,
    kind: kind ?? undefined,
    line: line ? Number(line) : undefined,
    column: column ? Number(column) : undefined,
    prop: prop ?? undefined,
    styleProps: styleProps ? styleProps.split(",").filter(Boolean) : []
  }
}

function getDefaultClassToken(tokens: string[]) {
  const token = tokens[0]

  return token ? getClassTokenOptions(token)[0] : null
}

function getClassTokenOptions(token: string) {
  const prefix = token.split("-")[0]

  if (!["text", "bg", "border"].includes(prefix)) {
    return [token]
  }

  return [
    `${prefix}-red-500`,
    `${prefix}-blue-500`,
    `${prefix}-green-500`,
    `${prefix}-slate-900`
  ]
}

function rgbToHex(color: string) {
  const match = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)

  if (!match) {
    return null
  }

  return `#${match
    .slice(1)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`
}

const panelStyle = {
  alignItems: "center",
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: 6,
  bottom: 16,
  color: "#f9fafb",
  display: "flex",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: 12,
  gap: 8,
  padding: "8px 10px",
  position: "fixed",
  right: 16,
  zIndex: 2147483647
} satisfies CSSProperties

function buttonStyle(active: boolean) {
  return {
    background: active ? "#2563eb" : "#f9fafb",
    border: 0,
    borderRadius: 5,
    color: active ? "#ffffff" : "#111827",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
    padding: "5px 8px"
  } satisfies CSSProperties
}

const popoverStyle = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxShadow: "0 20px 50px rgb(15 23 42 / 18%)",
  color: "#111827",
  display: "grid",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  gap: 8,
  padding: 12,
  position: "fixed",
  width: 320,
  zIndex: 2147483647
} satisfies CSSProperties

const labelStyle = {
  color: "#4b5563",
  fontSize: 12,
  fontWeight: 700
} satisfies CSSProperties

const inputStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 6,
  color: "#111827",
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  width: "100%"
} satisfies CSSProperties

const colorInputStyle = {
  height: 34,
  width: 64
} satisfies CSSProperties

const popoverFooterStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between"
} satisfies CSSProperties

const saveButtonStyle = {
  background: "#111827",
  border: 0,
  borderRadius: 6,
  color: "#ffffff",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: "7px 10px"
} satisfies CSSProperties

const secondaryButtonStyle = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  color: "#111827",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: "7px 10px"
} satisfies CSSProperties

const deleteButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: "#fecaca",
  color: "#b91c1c"
} satisfies CSSProperties

const diffStyle = {
  background: "#0f172a",
  borderRadius: 6,
  color: "#e5e7eb",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
  fontSize: 11,
  lineHeight: 1.4,
  margin: 0,
  maxHeight: 150,
  overflow: "auto",
  padding: 8,
  whiteSpace: "pre-wrap"
} satisfies CSSProperties

const statusStyle = {
  color: "#4b5563",
  fontSize: 12
} satisfies CSSProperties
