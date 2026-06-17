import { Capacitor, registerPlugin } from '@capacitor/core'

const Native = Capacitor.isNativePlatform()
  ? registerPlugin('TermuxBridge')
  : null

export const isNative = Capacitor.isNativePlatform()

export async function checkTermux() {
  if (!Native) return false
  try { const r = await Native.checkTermux(); return r.installed } catch { return false }
}

export async function requestStoragePermission() {
  if (!Native) return false
  try { const r = await Native.requestStorage(); return r.granted } catch { return false }
}

export async function exec(command, id) {
  if (!Native) return { sent: false, outputPath: null, error: '需要 Android 设备' }
  try { return await Native.run({ command, id }) } catch (e) { return { sent: false, outputPath: null, error: e.message || String(e) } }
}

export async function readOutput(path) {
  if (!Native) return { ready: false, content: '' }
  try { return await Native.readOutput({ path }) } catch { return { ready: false, content: '' } }
}

export async function poll(path, timeout = 20000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const r = await readOutput(path)
    if (r.ready) return r.content
    await new Promise(ok => setTimeout(ok, 600))
  }
  return null
}
