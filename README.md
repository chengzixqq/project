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

## 交互更新（近期）

- Step 3 技能选择改为“整张技能卡片点击选择/取消”，选中态与必带态有明显高亮，避免小复选框难点的问题。
- Step 4 新增两个快捷排序按钮：
  - 按 CD 从短到长
  - 按 CD 从长到短

## 数据维护流程（只维护 Excel，db.js 自动生成）

`逆水寒数据.xlsx` 是**唯一维护源**，`src/data/db.js` 是构建产物。

### 本地手动生成（可选）

请不要手改 `src/data/db.js`，本地需要预检时按下列流程：

1. 编辑 `逆水寒数据.xlsx`（职业技能 / 江湖技能 / 内功 / 机制）。
2. 运行生成脚本：

   ```bash
   node tools/build-db-from-xlsx.mjs
   ```

3. 运行校验脚本：

   ```bash
   node tools/check-db.mjs
   ```

### 云端自动生成（已支持）

仓库内置 `.github/workflows/auto-generate-db.yml`：

- 当 `逆水寒数据.xlsx`（或生成/校验脚本）更新并推送后，Actions 自动执行：
  1. `node tools/build-db-from-xlsx.mjs`
  2. `node tools/check-db.mjs`
  3. 若 `src/data/db.js` 有变化，自动提交回当前分支
- 已加入并发控制与 `github-actions[bot]` 触发保护，避免重复触发或冲突推送。

你只需要维护并上传 Excel，无需手动改 `db.js`。

### `db.js` 新结构说明

- `skills`：扁平数组，字段包括 `id/name/source/bucket/cd/duration/cast/dmg_reduction/note`。
  - `bucket` 取值：`职业技能 | 江湖技能 | 内功`
  - `cast` 来自 Excel 的“霸体时间”列
- `rules`：由“机制”工作表生成
- `meta.professions`：由“职业技能”表的“所属”去重生成
- `meta.jianghu_categories`：由“江湖技能”表的“所属”去重生成（如绝技/百家/群侠）

校验脚本会检查：
- 顶层结构完整性（`meta/skills/rules`）
- 技能 ID 唯一性、字段类型、负数与异常减伤值
- `meta.professions`、`meta.jianghu_categories` 与技能数据的一致性

## GitHub Actions（云端检查与打包）

仓库已提供 `.github/workflows/ci.yml`，作用：

1. 检查 JS 语法（`node --check`）
2. 将 `index.html`、`src/`、`examples/` 打包为 artifact（`dist/`）

你可以在 GitHub 的 Actions 页面下载打包产物用于分发。
