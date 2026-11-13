import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, ROOT } from './fixture.mjs'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

test('启动器捕获启动即退出；停止脚本只停止本项目进程', { skip: process.platform !== 'win32' }, async () => {
  const f = fixture()
  mkdirSync(resolve(f.root, 'scripts'))
  mkdirSync(resolve(f.root, 'client/node_modules/vite/bin'), { recursive: true })
  writeFileSync(resolve(f.root, 'scripts/package.json'), '{"type":"module"}')
  copyFileSync(resolve(ROOT, 'scripts/launcher.js'), resolve(f.root, 'scripts/launcher.js'))
  copyFileSync(resolve(ROOT, 'scripts/stop-services.ps1'), resolve(f.root, 'scripts/stop-services.ps1'))
  writeFileSync(resolve(f.root, 'server/src/index.js'), `import fs from 'node:fs';const p=${JSON.stringify(resolve(f.root, 'starts.txt'))};const n=fs.existsSync(p)?Number(fs.readFileSync(p))+1:1;fs.writeFileSync(p,String(n));if(n===1)process.exit(1);setInterval(()=>{},1000)`)
  writeFileSync(resolve(f.root, 'client/node_modules/vite/bin/vite.js'), 'setInterval(()=>{},1000)')
  const launcher = spawn(process.execPath, [resolve(f.root, 'scripts/launcher.js')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { windowsHide: true, stdio: 'ignore' })
  let log = ''
  launcher.stdout.on('data', data => log += data)
  launcher.stderr.on('data', data => log += data)
  try {
    for (let i = 0; i < 60; i++) {
      if (existsSync(resolve(f.root, 'starts.txt')) && Number(readFileSync(resolve(f.root, 'starts.txt'))) >= 2) break
      await new Promise(r => setTimeout(r, 100))
    }
    assert.equal(Number(readFileSync(resolve(f.root, 'starts.txt'))), 2, log)
    const stop = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(f.root, 'scripts/stop-services.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stopLog = ''; stop.stdout.on('data', data => stopLog += data); stop.stderr.on('data', data => stopLog += data)
    assert.equal(await new Promise(r => stop.once('exit', r)), 0, stopLog)
    for (let i = 0; i < 30 && launcher.exitCode === null; i++) await new Promise(r => setTimeout(r, 100))
    assert.notEqual(launcher.exitCode, null, stopLog)
    assert.equal(unrelated.exitCode, null)
    const childPids = [...log.matchAll(/启动进程 PID (\d+)/g)].map(match => Number(match[1]))
    for (const pid of childPids) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  } finally {
    if (launcher.exitCode === null) launcher.kill()
    for (const match of log.matchAll(/启动进程 PID (\d+)/g)) { try { process.kill(Number(match[1])) } catch {} }
    unrelated.kill()
  }
})
