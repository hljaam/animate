import { ipcMain, dialog } from 'electron'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'

// Set ffmpeg path
if (ffmpegStatic) {
  Ffmpeg.setFfmpegPath(ffmpegStatic)
}

interface ExportStartPayload {
  projectId: string
  fps: number
  width: number
  height: number
}

interface ExportFramePayload {
  projectId: string
  frame: number
  pixels: number[] // RGBA Uint8Array as regular array for IPC
  width: number
  height: number
}

export function registerExportHandlers(): void {
  const sessions = new Map<string, { tempDir: string; fps: number; width: number; height: number; frameCount: number }>()

  ipcMain.handle('export-start', async (_event, payload: ExportStartPayload) => {
    const tempDir = join(tmpdir(), `animate-export-${payload.projectId}-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    sessions.set(payload.projectId, {
      tempDir,
      fps: payload.fps,
      width: payload.width,
      height: payload.height,
      frameCount: 0
    })
    return { success: true }
  })

  ipcMain.handle('export-frame', async (_event, payload: ExportFramePayload) => {
    const session = sessions.get(payload.projectId)
    if (!session) return { success: false, error: 'No export session' }

    const pixels = new Uint8Array(payload.pixels)
    const filename = `frame_${String(payload.frame).padStart(6, '0')}.raw`
    writeFileSync(join(session.tempDir, filename), pixels)
    session.frameCount++
    return { success: true }
  })

  ipcMain.handle('export-finalize', async (event, payload: { projectId: string; totalFrames: number }) => {
    const session = sessions.get(payload.projectId)
    if (!session) return { success: false, error: 'No export session' }

    const saveResult = await dialog.showSaveDialog({
      title: 'Export MP4',
      defaultPath: 'output.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      cleanupSession(session.tempDir)
      sessions.clear()
      return { success: false }
    }

    const outputPath = saveResult.filePath
    const { tempDir, fps, width, height } = session

    return new Promise<{ success: boolean; filePath?: string; error?: string }>((resolve) => {
      Ffmpeg()
        .input(join(tempDir, 'frame_%06d.raw'))
        .inputOptions([
          '-f rawvideo',
          `-pixel_format rgba`,
          `-video_size ${width}x${height}`,
          `-r ${fps}`
        ])
        .videoCodec('libx264')
        .outputOptions(['-pix_fmt yuv420p', '-movflags +faststart'])
        .fps(fps)
        .output(outputPath)
        .on('progress', (progress) => {
          const percent = Math.round(
            ((progress.frames ?? 0) / payload.totalFrames) * 100
          )
          event.sender.send('export-progress', percent)
        })
        .on('end', () => {
          cleanupSession(tempDir)
          sessions.clear()
          resolve({ success: true, filePath: outputPath })
        })
        .on('error', (err) => {
          cleanupSession(tempDir)
          sessions.clear()
          resolve({ success: false, error: err.message })
        })
        .run()
    })
  })
}

function cleanupSession(tempDir: string): void {
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}
