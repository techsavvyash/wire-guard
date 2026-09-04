import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"

import {
  createWireGridEditHandler,
  instrumentSource,
  type WireGridEditHandlerRequest
} from "@techsavvyash/wire-grid"
import type { Plugin } from "vite"

export interface WireGridViteOptions {
  componentTextProps?: readonly string[]
  editEndpoint?: string
  enabled?: boolean
  instrumentComponentProps?: boolean
  instrumentComponentText?: boolean
  rootDir?: string
}

export function wireGrid(options: WireGridViteOptions = {}): Plugin {
  const editEndpoint = options.editEndpoint ?? "/__wire-grid/edit"
  let rootDir = path.resolve(options.rootDir ?? process.cwd())

  return {
    name: "wire-grid",
    apply: "serve",
    enforce: "pre",
    configResolved(config) {
      rootDir = path.resolve(options.rootDir ?? config.root)
    },
    configureServer(server) {
      if (options.enabled === false) {
        return
      }

      const handleWireGridEdit = createWireGridEditHandler({ rootDir })

      server.middlewares.use(editEndpoint, async (request, response, next) => {
        if (request.url !== "/" && request.url !== "") {
          next()
          return
        }

        if (request.method !== "POST") {
          sendJson(response, 405, {
            ok: false,
            code: "METHOD_NOT_ALLOWED",
            message: "Wire Grid edit endpoint only accepts POST requests."
          })
          return
        }

        try {
          const body = await readJsonBody<WireGridEditHandlerRequest>(request)
          const result = await handleWireGridEdit(body)

          sendJson(response, result.statusCode, result.payload)
        } catch (error) {
          sendJson(response, 400, {
            ok: false,
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Unknown error"
          })
        }
      })
    },
    transform(code, id) {
      if (options.enabled === false || !isEditableModule(id)) {
        return null
      }

      const filePath = id.split("?", 1)[0]
      const transformed = instrumentSource({
        code,
        componentTextProps: options.componentTextProps,
        filePath,
        includeCustomComponentProps: options.instrumentComponentProps,
        includeCustomComponents: options.instrumentComponentText,
        rootDir
      })

      return transformed === code ? null : { code: transformed, map: null }
    }
  }
}

function isEditableModule(id: string) {
  const filePath = id.split("?", 1)[0]

  return (
    !filePath.includes("/node_modules/") &&
    (filePath.endsWith(".jsx") || filePath.endsWith(".tsx"))
  )
}

function readJsonBody<T>(request: IncomingMessage) {
  return new Promise<T>((resolve, reject) => {
    let body = ""

    request.setEncoding("utf8")
    request.on("data", (chunk) => {
      body += chunk
    })
    request.on("end", () => {
      try {
        resolve(JSON.parse(body) as T)
      } catch {
        reject(new Error("Request body must be valid JSON."))
      }
    })
    request.on("error", reject)
  })
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader("content-type", "application/json")
  response.end(JSON.stringify(payload))
}
