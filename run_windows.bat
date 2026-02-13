@echo off
setlocal ENABLEDELAYEDEXPANSION

cd /d "%~dp0"
set "PORT=5173"
set "URL=http://localhost:%PORT%"

echo [1/3] 检查 Python...
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  set "PY_CMD=py -3"
  goto :start
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  set "PY_CMD=python"
  goto :start
)

where python3 >nul 2>nul
if %ERRORLEVEL%==0 (
  set "PY_CMD=python3"
  goto :start
)

echo.
echo 未检测到 Python（py/python/python3）。
echo 请先安装 Python 3 并勾选 “Add Python to PATH”，再双击本文件。
pause
exit /b 1

:start
echo [2/3] 启动本地静态服务：!PY_CMD! -m http.server %PORT%
start "" "%URL%"
echo [3/3] 浏览器已尝试打开：%URL%
echo.
echo 若需停止服务，请关闭本窗口（Ctrl+C）。

!PY_CMD! -m http.server %PORT%
