import { ipcMain, dialog } from 'electron'
import { writeFileSync, readFileSync } from 'fs'

export function registerProjectHandlers(): void {
  ipcMain.handle('save-project', async (_event, projectJson: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Project',
      defaultPath: 'my-project.animate',
      filters: [{ name: 'Animate Project', extensions: ['animate'] }]
    })

    if (result.canceled || !result.filePath) return { success: false }

    writeFileSync(result.filePath, projectJson, 'utf-8')
    return { success: true, filePath: result.filePath }
  })

  ipcMain.handle('open-project', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      filters: [{ name: 'Animate Project', extensions: ['animate'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const raw = readFileSync(result.filePaths[0], 'utf-8')
    return { filePath: result.filePaths[0], data: raw }
  })
}
