<p align="center">
  <img src="client/public/favicon.svg" width="64" height="64" alt="小金店" />
</p>

<h1 align="center">小金店</h1>
<p align="center">金 · 银 · 铂旧料管理工作台</p>
<p align="center">收旧、影像留档、库存、出售、换新、盘点和经营报表，放在一个清楚的工作台里。</p>

---

小金店是面向小型金店和旧料回收门店的本地管理系统。采用暖白、墨绿和香槟金界面，支持桌面操作及手机窄屏查看。适合单店、单人或少量店员在可信店内环境中使用。

**仓库仅包含程序源码、数据库结构、通用配置模板和合成测试夹具。实际业务数据库、客户资料、库存照片、本地配置、日志和备份均不随仓库提供。**

## 功能

| 模块 | 内容 |
| --- | --- |
| 经营首页 | 今日回收、出售和换新，库存参考估值、金属分类、存放位置及最近操作 |
| 旧料回收 | 金、银、铂混收，纯重及金额计算，逐件价格快照，混合付款 |
| 库存管理 | 一件一码，按编号、名称、金属、位置及状态查询 |
| 影像档案 | 整体照、钢印和瑕疵分类，摄像头拍照或文件上传，归档保护与缺图提示 |
| 旧料出售 | 扫码选件，按件设置单价，保存成本及毛利，拦截已出库旧料再次出售 |
| 以旧换新 | 从现有库存选择旧料抵扣新品，登记工费和收款 |
| 库存盘点 | 在库快照、实盘录入、差异记录、提交和取消 |
| 经营报表 | 日期查询、出售收入与成本、毛利及现有换新统计口径 |
| 门店设置 | 手动价格、融通金网页链接、交易方和门店参数 |
| 数据维护 | 数据库与影像联合备份、文件校验、恢复前备份和恢复中断回滚 |

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、Element Plus、Pinia、Vue Router |
| 后端 | Node.js、Express、Prisma |
| 数据库 | SQLite，16 张业务表 |
| 影像 | Multer、Sharp、本地文件存储 |
| 条码与打印 | JsBarcode、浏览器打印，预留网络打印接口 |
| 测试 | Node.js 内置测试运行器、独立 SQLite 测试库 |

金额使用整数分，重量使用 0.01 克，纯度使用万分比（例如 `9999 = 99.99%`），关键计算采用银行家舍入。

## 快速开始

环境要求：**Node.js 24+、npm**。一键启动、停止脚本面向 Windows；其他系统可分别运行前后端。

### 1. 获取源码并安装依赖

```powershell
git clone https://github.com/longyun001/xiaojindian.git
cd xiaojindian
npm ci --prefix server
npm ci --prefix client
```

### 2. 配置并初始化空数据库

以下命令用于全新安装；已有本地业务库时应保留原配置并按备份恢复流程操作。

```powershell
Copy-Item server/.env.example server/.env
cd server
npx prisma generate
npx prisma db push
npm run seed
cd ..
```

初始化脚本只创建通用门店配置，**不创建客户、行情、库存、订单或照片**。第一次使用时，请在“设置”中填写门店资料和金、银、铂的价格。

`DATABASE_URL="file:./dev.db"` 对应 `server/prisma/dev.db`。数据库和 `server/uploads/` 均留在本机。

### 3. 启动

Windows 双击 `start.bat`，或执行：

```powershell
node scripts/launcher.js
```

打开 [http://localhost:5173](http://localhost:5173)。后端默认端口为 `3000`；启动器直接管理前后端进程并在异常退出后尝试重启。Windows 可双击 `stop.bat` 停止本项目服务。

其他系统或分别调试时：

```sh
# 终端一
cd server
npm run dev

# 终端二
cd client
npm run dev
```

## 日常操作

1. 在“设置”维护价格和交易方。
2. 在“收旧”逐件录入材质、重量、纯度、单价与影像，核对付款后提交。
3. 在“库存”查询一件一码档案、影像和存放位置。
4. 通过“旧料出售”或现有“以旧换新”流程记录出库。
5. 用盘点和报表核对实物及经营记录，关店后备份。

参考估值取自已录入的价格；顶栏刷新会重新读取本系统保存的价格，不代表自动获取外部实时行情。银铂与黄金分别计价。

## 备份与恢复

- 先停止服务，再运行 `backup-data.bat`，备份保存到本机 `backups/`。
- `data-maintenance.bat` 提供检查、校验、恢复、残留锁处理及中断回滚菜单。
- 网页“设置 → 数据维护”可以检查数据库与影像文件，并导出检查结果。
- 恢复前自动保存当前数据；文件损坏或结构版本不匹配时拒绝恢复。

备份包括数据库、影像、结构和文件校验清单。**GitHub 仓库不是业务数据备份。** 完整步骤见 [备份恢复说明](docs/BACKUP_RESTORE.md)，上传边界见 [数据与隐私说明](docs/DATA_HANDLING.md)。

## 验证与构建

安装后端依赖并生成 Prisma Client 后，在项目根目录运行：

```powershell
node --test scripts/tests/*.test.mjs
node scripts/build-client.mjs
```

测试在 `.test-work/` 下建立独立数据库与合成影像，不向门店业务库写入交易。Windows 的启动停止进程测试会查询本机进程；非 Windows 环境跳过该项。

`node scripts/build-client.mjs` 输出到 `client/dist/`。也可以在 `client` 中运行 `npm run build`。当前一键入口使用 Vite 开发服务；公网部署、账户体系和生产托管不在当前交付范围内。

## 项目结构

```text
xiaojindian/
├── client/                 # Vue 页面、组件及样式
├── server/
│   ├── prisma/             # 数据结构与通用配置初始化
│   ├── src/                # 路由、计算、库存和影像服务
│   └── .env.example        # 无凭据的配置模板
├── scripts/
│   ├── tests/              # 合成夹具及隔离回归
│   ├── launcher.js         # 启动器
│   └── data-maintenance.mjs
├── docs/
├── start.bat
├── stop.bat
├── backup-data.bat
└── data-maintenance.bat
```

## 当前边界与待办

目前按可信店内环境设计，未实现登录权限体系。现有换新流程为“从库存选旧料抵扣新品”，换新利润统计不含新品成本，需要与实际门店做法核对。SQLite 是当前验证的数据后端，尚无 PostgreSQL 迁移交付。

已知需要补齐的场景包括回收提交重试去重，以及部分列表与报表的日期日界统一。历史单据中心、草稿保存、留痕作废等见 [后续计划](docs/ROADMAP.md)。实体打印机、扫码枪和摄像头需要结合设备验收。

当前仓库暂未选择开源许可证。
