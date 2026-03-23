import { execFile } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'

// ── Path Resolution ───────────────────────────────────────────────────────

/**
 * Resolves the path to the bundled Java executable.
 * Looks in bin/jre/bin/ (dev) or extraResources (prod).
 * Falls back to system 'java' if bundled JRE not found.
 */
export function getJavaPath(): string {
  const javaExe = process.platform === 'win32' ? 'java.exe' : 'java'

  // Production: check resourcesPath
  const prodPath = join(process.resourcesPath || '', 'ffdec', 'jre', 'bin', javaExe)
  if (existsSync(prodPath)) return prodPath

  // Development: check bin/jre relative to app root
  const devPath = join(app.getAppPath(), '..', '..', 'bin', 'jre', 'bin', javaExe)
  if (existsSync(devPath)) return devPath

  // Fallback: try CWD
  const cwdPath = join(process.cwd(), 'bin', 'jre', 'bin', javaExe)
  if (existsSync(cwdPath)) return cwdPath

  // Last resort: system Java
  return 'java'
}

/**
 * Resolves the path to ffdec.jar.
 */
export function getFfdecJarPath(): string {
  // Production: check resourcesPath
  const prodPath = join(process.resourcesPath || '', 'ffdec', 'ffdec.jar')
  if (existsSync(prodPath)) return prodPath

  // Development: check bin/ relative to app root
  const devPath = join(app.getAppPath(), '..', '..', 'bin', 'ffdec.jar')
  if (existsSync(devPath)) return devPath

  // Fallback: try CWD
  const cwdPath = join(process.cwd(), 'bin', 'ffdec.jar')
  if (existsSync(cwdPath)) return cwdPath

  throw new Error('ffdec.jar not found. Expected in bin/ or extraResources/ffdec/')
}

// ── Java Check ────────────────────────────────────────────────────────────

/**
 * Check if Java is available (bundled or system).
 */
export async function checkJavaAvailable(): Promise<boolean> {
  const javaPath = getJavaPath()
  return new Promise((resolve) => {
    execFile(javaPath, ['-version'], { timeout: 10000 }, (error) => {
      resolve(!error)
    })
  })
}

// ── JPEXS CLI Commands ────────────────────────────────────────────────────

/**
 * Export assets from an SWF file using JPEXS FFDec CLI.
 * @param type - Asset type: image, shape, text, sound, font, sprite, all
 */
export async function exportAssets(
  swfPath: string,
  outputDir: string,
  type: 'image' | 'shape' | 'text' | 'sound' | 'font' | 'sprite' | 'all' | 'xfl' | 'fla'
): Promise<string> {
  const javaPath = getJavaPath()
  const jarPath = getFfdecJarPath()
  return new Promise((resolve, reject) => {
    execFile(
      javaPath,
      ['-jar', jarPath, '-export', type, outputDir, swfPath],
      { timeout: 60000, maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && !stdout && !stderr) {
          reject(new Error(`JPEXS export failed: ${error.message}`))
        } else {
          // JPEXS may write warnings to stderr even on success
          resolve(stdout + stderr)
        }
      }
    )
  })
}

/**
 * Convert SWF to XML using JPEXS FFDec CLI (-swf2xml).
 * Returns the XML string containing all tags, timeline, matrices, etc.
 */
export async function dumpSwf(swfPath: string): Promise<string> {
  const javaPath = getJavaPath()
  const jarPath = getFfdecJarPath()
  const tempXml = join(
    app.getPath('temp'),
    'animate-swf2xml-' + Date.now() + '.xml'
  )
  return new Promise((resolve, reject) => {
    execFile(
      javaPath,
      ['-jar', jarPath, '-swf2xml', swfPath, tempXml],
      { timeout: 60000, maxBuffer: 100 * 1024 * 1024 },
      async (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`JPEXS swf2xml failed: ${error.message}\n${stderr}`))
          return
        }
        try {
          const { readFileSync, unlinkSync } = await import('fs')
          const xml = readFileSync(tempXml, 'utf-8')
          try { unlinkSync(tempXml) } catch { /* ignore */ }
          resolve(xml)
        } catch (readErr) {
          reject(new Error(`Failed to read swf2xml output: ${readErr}`))
        }
      }
    )
  })
}
