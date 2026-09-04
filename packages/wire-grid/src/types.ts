export interface WireGridSourceLocation {
  file: string
  line?: number
  column?: number
  id?: string
  prop?: string
}

export type WireGridEdit =
  | {
      kind: "jsx-delete"
    }
  | {
      kind: "jsx-text"
      value: string
    }
  | {
      kind: "jsx-attribute-string"
      name: string
      value: string
    }
  | {
      kind: "class-token-replace"
      from: string
      to: string
    }
  | {
      kind: "inline-style-set"
      property: string
      value: string
    }

export interface WireGridEditRequest {
  source: WireGridSourceLocation
  edit: WireGridEdit
  preview?: boolean
}

export type WireGridEditResponse =
  | {
      ok: true
      file: string
      changed: boolean
      diff?: string
      preview?: boolean
    }
  | {
      ok: false
      code: string
      message: string
    }

export interface ValidateSourcePathOptions {
  rootDir: string
  filePath: string
  allowedExtensions?: readonly string[]
}

export interface ApplyEditOptions {
  rootDir: string
  request: WireGridEditRequest
}
