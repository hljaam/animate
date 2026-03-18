export interface ICommand {
  execute(): void
  undo(): void
  description: string
}

export class CommandHistory {
  private stack: ICommand[] = []
  private cursor: number = -1

  push(cmd: ICommand): void {
    // Truncate any redo history
    this.stack = this.stack.slice(0, this.cursor + 1)
    cmd.execute()
    this.stack.push(cmd)
    this.cursor++
  }

  undo(): boolean {
    if (this.cursor < 0) return false
    this.stack[this.cursor].undo()
    this.cursor--
    return true
  }

  redo(): boolean {
    if (this.cursor >= this.stack.length - 1) return false
    this.cursor++
    this.stack[this.cursor].execute()
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
  }
}
