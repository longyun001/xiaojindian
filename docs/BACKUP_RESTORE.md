# 本地备份与恢复

需要 Node.js 24+。备份和恢复期间先停止本项目服务，使数据库与照片保持同一状态。

## 备份

1. Windows 双击 `stop.bat`。
2. 双击 `backup-data.bat`，或在根目录执行 `node scripts/data-maintenance.mjs backup`。
3. 记录成功返回的备份目录，并将完整目录另存到其他磁盘。

每个备份包括：

| 内容 | 用途 |
| --- | --- |
| `database.sqlite` | SQLite 一致性快照，包含已提交的 WAL 数据 |
| `uploads/` | 全部现存影像及临时文件 |
| `schema.prisma` | 该备份对应的数据结构 |
| `integrity.json` | 数据库、表数量及影像文件检查结果 |
| `manifest.json` | 创建时间、文件大小、SHA-256 与已知异常数量 |

备份不包含 `.env` 或程序依赖。换电脑时还需要源码、Node.js、依赖及自行配置的运行参数。`.partial-` 开头的目录是未完成备份，不应当作成功备份使用。

## 校验与恢复

打开 `data-maintenance.bat`，先选择“校验备份”，输入包含 `manifest.json` 的目录；通过后选择“从备份恢复”。

程序会展示备份时间和数据数量。确认完整备份时输入 `RESTORE`；确认含已知缺图的备份时输入 `RESTORE WITH MISSING PHOTOS`。

恢复前会自动创建当前数据的 `before-restore` 备份。原数据库和照片另存于 `server/.restore-old-*`，再安装所选备份并复核。清单不符、文件损坏、路径不合法、结构版本不匹配的备份会被拒绝。

备份无法补回备份前已经缺失的照片，缺失影像记录会如实保留。恢复后重新启动，在“设置 → 数据维护”检查，并抽查单据和照片。

## 异常中断

恢复未结束时，程序会保留 `.restore-in-progress.json` 并阻止业务启动。打开维护菜单执行“恢复中断回滚”。新旧数据目录都会保留，避免直接删除业务资料。

如果回滚报错，保留所有备份、恢复日志、`.restore-old-*` 和 `.restore-stage-*` 目录。对应进程已经退出的残留锁可自动清理；手工解除锁也不会结束其他进程。

## 命令行

```powershell
node scripts/data-maintenance.mjs check
node scripts/data-maintenance.mjs backup
node scripts/data-maintenance.mjs verify "D:\shop-backup\backup-directory"
node scripts/data-maintenance.mjs restore "D:\shop-backup\backup-directory"
node scripts/data-maintenance.mjs recover
```

`check` 和网页检查核对数据库及影像路径、存在、非空情况，备份校验还会检查文件哈希；照片内容和实物是否一致仍需人工核对。
