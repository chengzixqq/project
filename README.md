# 逆水寒技能循环排轴工具

这是一个**纯前端静态项目**（HTML + CSS + 原生 JS 模块），不依赖后端。

## 本地运行方式

> 不建议直接双击 `index.html`，因为浏览器对 ES Module 和跨文件读取有安全限制。

### 方式一：Python（推荐）

```bash
cd /path/to/project
python3 -m http.server 5173
```

浏览器打开：`http://localhost:5173`

### 方式二：Node

```bash
cd /path/to/project
npx serve -l 5173
```

浏览器打开：`http://localhost:5173`

### 方式三：Windows 一键启动（双击即可）

仓库根目录新增 `run_windows.bat`，双击后会自动：

1. 检测 Python（`py` / `python` / `python3`）
2. 启动本地服务（端口 `5173`）
3. 在**独立终端窗口**启动服务（可见日志）
4. 自动打开浏览器到 `http://localhost:5173`

> 需要你本机已安装 Python 3，并加入 PATH。
> 停止服务：切到“逆水寒排轴本地服务(5173)”窗口按 `Ctrl+C`，或直接关闭该窗口。

## 需要先编译吗？

当前仓库不需要编译，可以直接以静态站点方式运行。

## 数据维护建议（Excel -> db.js）

当前前端实际读取的是 `src/data/db.js`，该文件的 `meta.source_file` 指向 `逆水寒数据.xlsx`。建议把 Excel 当成**编辑源**，`db.js` 当成**发布产物**，统一按以下流程维护：

1. 修改 `逆水寒数据.xlsx`。
2. 运行构建脚本，从 4 张表（机制/职业技能/江湖技能/内功）生成 `src/data/db.js`。
3. 运行数据校验脚本，避免重复名、负数、异常减伤值进入主分支。

```bash
python3 tools/build-db-from-xlsx.py
node tools/check-db.mjs
```

脚本会检查：
- 技能名是否缺失或重复（按职业/类别分桶）。
- `cd/cast/duration/dmg_reduction` 是否为非负数字（或空值）。
- `dmg_reduction` 是否超过 100。
- `cast` 是否大于 `duration`（常见录入错误）。

### 推荐的表结构优化点

为后续扩展「群侠」以及更多职业，建议在 Excel 中补充这些字段（即使暂时为空，也先占位）：

- `id`：稳定主键（避免技能重名导致后续 merge 冲突）。
- `source_type`：`profession / ultimate / neigong / baijia / qunxia`。
- `source_name`：职业名或类别名（例如 `妙音`、`绝技`）。
- `enabled`：是否启用（用于暂存未实装技能而不删行）。
- `version` 或 `patch`：记录技能参数对应版本。

这样你后续做批量改表、跨职业比对、或自动生成差异日志会更轻松。

## GitHub Actions（云端检查与打包）

仓库已提供 `.github/workflows/ci.yml`，作用：

1. 检查 JS 语法（`node --check`）
2. 将 `index.html`、`src/`、`examples/` 打包为 artifact（`dist/`）

你可以在 GitHub 的 Actions 页面下载打包产物用于分发。
