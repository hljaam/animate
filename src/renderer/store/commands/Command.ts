import { type Patch, applyPatches } from 'immer'
import type { Project } from '../../types/project'

export interface PatchEntry {
  description: string
  patches: Patch[]
  inversePatches: Patch[]
}

export class CommandHistory {
  private stack: PatchEntry[] = []
  private cursor: number = -1
  private _version: number = 0
  private _onChanged?: () => void
  private _getProject?: () => Project | null
  private _setProject?: (project: Project) => void

  setOnChanged(cb: () => void): void {
    this._onChanged = cb
  }

  setProjectAccessors(
    getProject: () => Project | null,
    setProject: (project: Project) => void
  ): void {
    this._getProject = getProject
    this._setProject = setProject
  }

  get version(): number {
    return this._version
  }

  pushPatches(description: string, patches: Patch[], inversePatches: Patch[]): void {
    // Truncate any redo history
    this.stack = this.stack.slice(0, this.cursor + 1)
    this.stack.push({ description, patches, inversePatches })
    this.cursor++
    this._version++
    this._onChanged?.()
  }

  undo(): boolean {
    if (this.cursor < 0) return false
    const entry = this.stack[this.cursor]
    const project = this._getProject?.()
    if (!project) return false
    const next = applyPatches(project, entry.inversePatches)
    this._setProject?.(next)
    this.cursor--
    this._version++
    this._onChanged?.()
    return true
  }

  redo(): boolean {
    if (this.cursor >= this.stack.length - 1) return false
    this.cursor++
    const entry = this.stack[this.cursor]
    const project = this._getProject?.()
    if (!project) return false
    const next = applyPatches(project, entry.patches)
    this._setProject?.(next)
    this._version++
    this._onChanged?.()
    return true
  }

  canUndo(): boolean {
    return this.cursor >= 0
  }

  canRedo(): boolean {
    return this.cursor < this.stack.length - 1
  }

  clear(): void {
    this.stack = []
    this.cursor = -1
    this._version++
    this._onChanged?.()
  }
}
