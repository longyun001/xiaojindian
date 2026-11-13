import { dirname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const UPLOADS_ROOT = resolve(SERVER_ROOT, 'uploads')

export function within(root, target) {
  const rel = relative(resolve(root), resolve(target))
  return rel !== '' && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../') && !isAbsolute(rel)
}

export function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || /[:\0]/.test(value)) throw new Error('文件路径不合法')
  const normalized = value.replace(/\\/g, '/')
  if (normalized.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('文件路径不合法')
  return normalized
}
