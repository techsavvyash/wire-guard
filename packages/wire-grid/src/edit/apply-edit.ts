import { promises as fs } from "node:fs"

import * as t from "@babel/types"
import { parse, print } from "recast"
import * as babelTsParser from "recast/parsers/babel-ts.js"
import { format } from "prettier"

import { walkAst } from "../internal/ast.js"
import type { ApplyEditOptions, WireGridEditRequest } from "../types.js"
import { validateSourcePath } from "../security/validate-source-path.js"

export async function applyEdit({ rootDir, request }: ApplyEditOptions) {
  const preview = await previewEdit({ rootDir, request })

  if (!preview.ok) {
    return preview
  }

  if (!request.preview && preview.code !== undefined && preview.changed) {
    const file = validateSourcePath({
      rootDir,
      filePath: request.source.file
    })

    await fs.writeFile(file, preview.code)
  }

  return {
    ok: true,
    file: request.source.file,
    changed: preview.changed,
    diff: preview.diff,
    preview: request.preview || undefined
  } as const
}

export async function previewEdit({ rootDir, request }: ApplyEditOptions) {
  if (
    request.edit.kind !== "jsx-delete" &&
    request.edit.kind !== "jsx-text" &&
    request.edit.kind !== "jsx-attribute-string" &&
    request.edit.kind !== "class-token-replace" &&
    request.edit.kind !== "inline-style-set"
  ) {
    return unsupported(
      `Unsupported edit kind: ${(request.edit as { kind: string }).kind}`
    )
  }

  if (!request.source.id) {
    return unsupported("Missing source element id.")
  }

  const file = validateSourcePath({
    rootDir,
    filePath: request.source.file
  })
  const code = await fs.readFile(file, "utf8")
  const result = applyEditToCode(code, request)

  if (!result.ok) {
    return result
  }

  const formattedCode =
    result.code === code
      ? result.code
      : await format(result.code, {
          filepath: file,
          semi: false
        })

  return {
    ok: true,
    file: request.source.file,
    changed: formattedCode !== code,
    code: formattedCode,
    diff: createLineDiff(code, formattedCode),
    preview: true
  } as const
}

function applyEditToCode(code: string, request: WireGridEditRequest) {
  switch (request.edit.kind) {
    case "jsx-delete":
      return applyJsxDeleteEdit(code, request)
    case "jsx-attribute-string":
      return applyJsxAttributeStringEdit(code, request)
    case "class-token-replace":
      return applyClassTokenReplaceEdit(code, request)
    case "inline-style-set":
      return applyInlineStyleEdit(code, request)
    case "jsx-text":
      return applyJsxTextEdit(code, request)
  }
}

interface AstNodePath {
  index?: number
  key: string
  node: t.Node
  parent: t.Node
  parentPath?: AstNodePath
}

export function applyJsxDeleteEdit(
  code: string,
  request: WireGridEditRequest
) {
  if (request.edit.kind !== "jsx-delete") {
    return unsupported(`Unsupported edit kind: ${request.edit.kind}`)
  }

  if (!request.source.id) {
    return unsupported("Missing source element id.")
  }

  const ast = parse(code, {
    parser: babelTsParser
  })
  const targetPath = findTargetElementPath(ast, request)

  if (!targetPath) {
    return unsupported("Could not find the selected JSX element.")
  }

  if (!deleteJsxElement(targetPath)) {
    return unsupported(
      "The selected JSX element cannot be deleted without invalidating its source."
    )
  }

  return {
    ok: true,
    code: print(ast).code
  } as const
}

function deleteJsxElement(targetPath: AstNodePath) {
  const paths = getAncestorPaths(targetPath)

  if (removeJsxChild(targetPath)) {
    return true
  }

  const conditionalPath = paths.find(
    (path) =>
      t.isConditionalExpression(path.parent) &&
      (path.key === "consequent" || path.key === "alternate")
  )

  if (conditionalPath) {
    setNodePath(conditionalPath, t.nullLiteral())
    return true
  }

  const logicalPath = paths.find(
    (path) => t.isLogicalExpression(path.parent) && path.key === "right"
  )

  if (logicalPath) {
    const containerPath = paths.find((path) =>
      t.isJSXExpressionContainer(path.node)
    )

    if (containerPath && removeJsxChild(containerPath)) {
      return true
    }

    setNodePath(logicalPath, t.nullLiteral())
    return true
  }

  const mapBodyPath = paths.find(
    (path) =>
      t.isArrowFunctionExpression(path.parent) &&
      path.key === "body" &&
      isMapCallback(path.parent, path.parentPath)
  )

  if (mapBodyPath) {
    const containerPath = paths.find((path) =>
      t.isJSXExpressionContainer(path.node)
    )

    if (containerPath && removeJsxChild(containerPath)) {
      return true
    }

    setNodePath(mapBodyPath, t.nullLiteral())
    return true
  }

  const expressionPath = paths.find(
    (path) =>
      t.isJSXExpressionContainer(path.parent) && path.key === "expression"
  )

  if (expressionPath && removeJsxChild(expressionPath.parentPath)) {
    return true
  }

  const replaceablePath = paths.find(
    (path) =>
      (t.isReturnStatement(path.parent) && path.key === "argument") ||
      (t.isVariableDeclarator(path.parent) && path.key === "init") ||
      (t.isArrowFunctionExpression(path.parent) && path.key === "body") ||
      (t.isJSXExpressionContainer(path.parent) && path.key === "expression")
  )

  if (replaceablePath) {
    setNodePath(replaceablePath, t.nullLiteral())
    return true
  }

  return false
}

function getAncestorPaths(path: AstNodePath) {
  const paths: AstNodePath[] = []
  let current: AstNodePath | undefined = path

  while (current) {
    paths.push(current)
    current = current.parentPath
  }

  return paths
}

function findTargetElementPath(ast: unknown, request: WireGridEditRequest) {
  let result: AstNodePath | undefined

  function visit(node: unknown, nodePath?: AstNodePath) {
    if (!t.isNode(node) || result) {
      return
    }

    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
          const child = value[index]

          if (!t.isNode(child)) {
            continue
          }

          const childPath = {
            index,
            key,
            node: child,
            parent: node,
            parentPath: nodePath
          }

          if (t.isJSXElement(child) && isTargetElement(child, request)) {
            result = childPath
            return
          }

          visit(child, childPath)
        }
        continue
      }

      if (t.isNode(value)) {
        const childPath = {
          key,
          node: value,
          parent: node,
          parentPath: nodePath
        }

        if (t.isJSXElement(value) && isTargetElement(value, request)) {
          result = childPath
          return
        }

        visit(value, childPath)
      }
    }
  }

  visit(ast)
  return result
}

function removeJsxChild(path: AstNodePath | undefined) {
  if (
    !path ||
    path.key !== "children" ||
    path.index === undefined ||
    (!t.isJSXElement(path.parent) && !t.isJSXFragment(path.parent))
  ) {
    return false
  }

  path.parent.children.splice(path.index, 1)
  return true
}

function setNodePath(path: AstNodePath, value: t.Node) {
  if (path.index !== undefined) {
    const values = (path.parent as unknown as Record<string, unknown[]>)[path.key]
    values[path.index] = value
    return
  }

  ;(path.parent as unknown as Record<string, unknown>)[path.key] = value
}

function isMapCallback(
  callback: t.ArrowFunctionExpression,
  callbackPath: AstNodePath | undefined
) {
  if (!callbackPath || !t.isCallExpression(callbackPath.parent)) {
    return false
  }

  const callee = callbackPath.parent.callee

  return (
    callbackPath.key === "arguments" &&
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.property, { name: "map" }) &&
    callbackPath.node === callback
  )
}

export function applyClassTokenReplaceEdit(
  code: string,
  request: WireGridEditRequest
) {
  if (request.edit.kind !== "class-token-replace") {
    return unsupported(`Unsupported edit kind: ${request.edit.kind}`)
  }

  if (!request.source.id) {
    return unsupported("Missing source element id.")
  }

  const ast = parse(code, {
    parser: babelTsParser
  })
  const targetElement = findTargetElement(ast, request)

  if (!targetElement) {
    return unsupported("Could not find the selected JSX element.")
  }

  const classNameAttribute = targetElement.openingElement.attributes.find(
    (attribute) =>
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: "className" })
  )

  if (
    !classNameAttribute ||
    !t.isJSXAttribute(classNameAttribute) ||
    !t.isStringLiteral(classNameAttribute.value)
  ) {
    return unsupported("The selected element does not have an editable className.")
  }

  const tokens = classNameAttribute.value.value.split(/\s+/)
  const tokenIndex = tokens.indexOf(request.edit.from)

  if (tokenIndex === -1) {
    return unsupported(`Could not find class token: ${request.edit.from}`)
  }

  tokens[tokenIndex] = request.edit.to
  classNameAttribute.value = t.stringLiteral(tokens.join(" "))

  return {
    ok: true,
    code: print(ast).code
  } as const
}

export function applyInlineStyleEdit(
  code: string,
  request: WireGridEditRequest
) {
  if (request.edit.kind !== "inline-style-set") {
    return unsupported(`Unsupported edit kind: ${request.edit.kind}`)
  }

  if (!request.source.id) {
    return unsupported("Missing source element id.")
  }

  const ast = parse(code, {
    parser: babelTsParser
  })
  const targetElement = findTargetElement(ast, request)

  if (!targetElement) {
    return unsupported("Could not find the selected JSX element.")
  }

  const styleAttribute = targetElement.openingElement.attributes.find(
    (attribute) =>
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: "style" })
  )

  if (
    !styleAttribute ||
    !t.isJSXAttribute(styleAttribute) ||
    !t.isJSXExpressionContainer(styleAttribute.value) ||
    !t.isObjectExpression(styleAttribute.value.expression)
  ) {
    return unsupported("The selected element does not have an editable style object.")
  }

  setObjectStyleProperty(
    styleAttribute.value.expression,
    request.edit.property,
    request.edit.value
  )

  return {
    ok: true,
    code: print(ast).code
  } as const
}

export function applyJsxAttributeStringEdit(
  code: string,
  request: WireGridEditRequest
) {
  if (request.edit.kind !== "jsx-attribute-string") {
    return unsupported(`Unsupported edit kind: ${request.edit.kind}`)
  }

  if (!request.source.id) {
    return unsupported("Missing source element id.")
  }

  if (!request.edit.name) {
    return unsupported("Missing editable prop name.")
  }

  const attributeName = request.edit.name
  const ast = parse(code, {
    parser: babelTsParser
  })
  const targetElement = findTargetElement(ast, request)

  if (!targetElement) {
    return unsupported("Could not find the selected JSX element.")
  }

  const targetAttribute = targetElement.openingElement.attributes.find(
    (attribute) =>
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: attributeName })
  )

  if (!targetAttribute || !t.isJSXAttribute(targetAttribute)) {
    return unsupported(`Could not find editable prop: ${attributeName}`)
  }

  if (!t.isStringLiteral(targetAttribute.value)) {
    return unsupported(`Prop is not a string literal: ${attributeName}`)
  }

  targetAttribute.value = t.stringLiteral(request.edit.value)

  return {
    ok: true,
    code: print(ast).code
  } as const
}

export function applyJsxTextEdit(
  code: string,
  request: WireGridEditRequest
) {
  if (request.edit.kind !== "jsx-text") {
    return unsupported(`Unsupported edit kind: ${request.edit.kind}`)
  }

  const sourceId = request.source.id
  const nextValue = request.edit.value

  if (!sourceId) {
    return unsupported("Missing source element id.")
  }

  const ast = parse(code, {
    parser: babelTsParser
  })

  const targetElement = findTargetElement(ast, request)

  if (!targetElement) {
    return unsupported("Could not find the selected JSX element.")
  }

  const textChild = targetElement.children.find((child) => t.isJSXText(child))

  if (!textChild || !t.isJSXText(textChild)) {
    return unsupported("The selected element does not contain editable text.")
  }

  textChild.value = replaceTrimmedText(textChild.value, nextValue, targetElement)

  return {
    ok: true,
    code: print(ast).code
  } as const
}

function findTargetElement(ast: unknown, request: WireGridEditRequest) {
  const targetElements: t.JSXElement[] = []

  walkAst(ast, (node) => {
    if (targetElements.length > 0 || !t.isJSXElement(node)) {
      return
    }

    if (isTargetElement(node, request)) {
      targetElements.push(node)
    }
  })

  return targetElements[0]
}

function replaceTrimmedText(
  originalValue: string,
  nextValue: string,
  element: t.JSXElement
) {
  if (
    originalValue.includes("\n") ||
    (element.openingElement.loc &&
      element.closingElement?.loc &&
      element.openingElement.loc.end.line < element.closingElement.loc.start.line)
  ) {
    const elementIndent = " ".repeat(element.openingElement.loc?.start.column ?? 0)
    const textIndent = `${elementIndent}  `

    return `\n${textIndent}${nextValue}\n${elementIndent}`
  }

  const leadingWhitespace = originalValue.match(/^\s*/)?.[0] ?? ""
  const trailingWhitespace = originalValue.match(/\s*$/)?.[0] ?? ""

  return `${leadingWhitespace}${nextValue}${trailingWhitespace}`
}

function hasWireGridId(openingElement: t.JSXOpeningElement, id: string) {
  return openingElement.attributes.some((attribute) => {
    if (!t.isJSXAttribute(attribute)) {
      return false
    }

    if (!t.isJSXIdentifier(attribute.name, { name: "data-wg-id" })) {
      return false
    }

    return t.isStringLiteral(attribute.value) && attribute.value.value === id
  })
}

function setObjectStyleProperty(
  styleObject: t.ObjectExpression,
  propertyName: string,
  value: string
) {
  const existingProperty = styleObject.properties.find((property) => {
    if (!t.isObjectProperty(property)) {
      return false
    }

    return isStylePropertyKey(property.key, propertyName)
  })

  if (existingProperty && t.isObjectProperty(existingProperty)) {
    existingProperty.value = t.stringLiteral(value)
    return
  }

  styleObject.properties.push(
    t.objectProperty(toStylePropertyKey(propertyName), t.stringLiteral(value))
  )
}

function isStylePropertyKey(key: t.ObjectProperty["key"], propertyName: string) {
  if (t.isIdentifier(key)) {
    return key.name === propertyName
  }

  return t.isStringLiteral(key) && key.value === propertyName
}

function toStylePropertyKey(propertyName: string) {
  if (/^[A-Za-z_$][\w$]*$/.test(propertyName)) {
    return t.identifier(propertyName)
  }

  return t.stringLiteral(propertyName)
}

function isTargetElement(element: t.JSXElement, request: WireGridEditRequest) {
  if (request.source.id && hasWireGridId(element.openingElement, request.source.id)) {
    return true
  }

  return (
    request.source.line !== undefined &&
    request.source.column !== undefined &&
    element.openingElement.loc?.start.line === request.source.line &&
    element.openingElement.loc.start.column === request.source.column
  )
}

function unsupported(message: string) {
  return {
    ok: false,
    code: "UNSUPPORTED_NODE",
    message
  } as const
}

function createLineDiff(before: string, after: string) {
  if (before === after) {
    return ""
  }

  const beforeLines = before.split("\n")
  const afterLines = after.split("\n")
  const maxLength = Math.max(beforeLines.length, afterLines.length)
  const lines: string[] = []

  for (let index = 0; index < maxLength; index += 1) {
    const beforeLine = beforeLines[index]
    const afterLine = afterLines[index]

    if (beforeLine === afterLine) {
      continue
    }

    if (beforeLine !== undefined) {
      lines.push(`- ${beforeLine}`)
    }

    if (afterLine !== undefined) {
      lines.push(`+ ${afterLine}`)
    }
  }

  return lines.join("\n")
}
