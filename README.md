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
3. 自动打开浏览器到 `http://localhost:5173`

> 需要你本机已安装 Python 3，并加入 PATH。

## 需要先编译吗？

当前仓库不需要编译，可以直接以静态站点方式运行。

## GitHub Actions（云端检查与打包）

仓库已提供 `.github/workflows/ci.yml`，作用：

1. 检查 JS 语法（`node --check`）
2. 将 `index.html`、`src/`、`examples/` 打包为 artifact（`dist/`）

你可以在 GitHub 的 Actions 页面下载打包产物用于分发。
