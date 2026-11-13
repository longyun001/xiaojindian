// 直接持有两个 Node 子进程，退出监听先于健康检查注册。
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configs = [
  { name: '后端', cwd: resolve(ROOT, 'server'), args: [resolve(ROOT, 'server/src/index.js')], health: 'http://localhost:3000/api/health' },
  { name: '前端', cwd: resolve(ROOT, 'client'), args: [resolve(ROOT, 'client/node_modules/vite/bin/vite.js'), '--host', '--strictPort'] }
]
const states = new Map()
let stopping = false
const log = (name, message) => console.log(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [${name}] ${message}`)

async function healthCheck(cfg, proc) {
  const deadline = Date.now() + 8000
  while (!stopping && proc.exitCode === null && !proc.killed && Date.now() < deadline) {
    try {
      const response = await fetch(cfg.health, { signal: AbortSignal.timeout(1000) })
      if (response.ok && proc.exitCode === null && !proc.killed) { log(cfg.name, '健康检查通过'); return }
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  if (!stopping && proc.exitCode === null && !proc.killed) log(cfg.name, '健康检查未通过，请查看上方错误')
}

function start(cfg) {
  if (stopping) return
  const state = states.get(cfg.name) || { restarts: 0, timer: null, proc: null }
  states.set(cfg.name, state)
  const proc = spawn(process.execPath, cfg.args, { cwd: cfg.cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  state.proc = proc
  log(cfg.name, `启动进程 PID ${proc.pid || '待分配'}`)
  const pipe = data => { for (const line of data.toString().split(/\r?\n/).filter(Boolean)) log(cfg.name, line) }
  proc.stdout.on('data', pipe)
  proc.stderr.on('data', pipe)
  let handled = false
  const restart = reason => {
    if (handled) return
    handled = true
    if (stopping) return
    log(cfg.name, reason)
    if (++state.restarts > 20) { log(cfg.name, '已达重启上限，请检查错误后重新启动'); return }
    state.timer = setTimeout(() => start(cfg), 1500)
  }
  proc.once('exit', (code, signal) => restart(`进程退出，code=${code}，signal=${signal}；准备重启`))
  proc.once('error', error => restart('启动失败：' + error.message))
  if (cfg.health) void healthCheck(cfg, proc)
}

async function shutdown() {
  if (stopping) return
  stopping = true
  const waits = []
  for (const state of states.values()) {
    clearTimeout(state.timer)
    if (state.proc && state.proc.exitCode === null && !state.proc.killed) {
      waits.push(new Promise(r => state.proc.once('exit', r)))
      state.proc.kill('SIGTERM')
    }
  }
  await Promise.all(waits)
  console.log('小金店服务已停止')
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
if (process.platform === 'win32') process.once('SIGBREAK', shutdown)
process.once('exit', () => {
  for (const state of states.values()) if (state.proc?.exitCode === null && !state.proc.killed) state.proc.kill()
})

for (const cfg of configs) {
  if (!existsSync(resolve(cfg.cwd, 'node_modules')) || !existsSync(cfg.args[0])) {
    console.error('缺少依赖或程序文件：' + cfg.cwd)
    process.exit(1)
  }
}
for (const cfg of configs) start(cfg)
console.log('小金店启动中，浏览器地址 http://localhost:5173；Ctrl+C 或 stop.bat 停止服务。')
