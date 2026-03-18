import { ipcMain, dialog, app } from 'electron'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { imageSize } from 'image-size'
import { nanoid } from 'nanoid'

export function registerAssetHandlers(): void {
  ipcMain.handle('import-asset', async (_event, projectId: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Import Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile', 'multiSelections']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const assets = []
    const assetsDir = getProjectAssetsDir(projectId)
    mkdirSync(assetsDir, { recursive: true })

    for (const srcPath of result.filePaths) {
      const id = nanoid()
      const ext = extname(srcPath)
      const destFilename = `${id}${ext}`
      const destPath = join(assetsDir, destFilename)

      copyFileSync(srcPath, destPath)

      let width = 0
      let height = 0
      try {
        const dims = imageSize(destPath)
        width = dims.width ?? 0
        height = dims.height ?? 0
      } catch {
        // ignore dimension errors
      }

      assets.push({
        id,
        type: 'image',
        name: basename(srcPath),
        localBundlePath: destPath,
        width,
        height
      })
    }

    return assets
  })
}

export function getProjectAssetsDir(projectId: string): string {
  return join(app.getPath('userData'), 'projects', projectId, '.project_assets')
}
