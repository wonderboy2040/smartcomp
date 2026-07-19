/**
 * Smart Computers — Electron preload
 *
 * Runs in an isolated context with Node access but exposes only safe APIs
 * to the renderer (the Next.js web page).
 *
 * Currently we expose:
 *   - smartcomp.platform  -> 'win32' | 'darwin' | 'linux'
 *   - smartcomp.version   -> app version string
 *   - smartcomp.openExternal(url) -> opens URL in default browser
 *
 * No file system or shell access is exposed — the Next.js app talks to its
 * own /api/* routes for everything (including writing the runtime config).
 */

const { contextBridge, ipcRenderer, shell } = require('electron')

contextBridge.exposeInMainWorld('smartcomp', {
  platform: process.platform,
  isElectron: true,
  version: process.env.npm_package_version || 'unknown',
  openExternal: (url) => shell.openExternal(url),
  // Reserved for future IPC if we want desktop notifications, etc.
  on: (channel, cb) => ipcRenderer.on(channel, cb),
})
