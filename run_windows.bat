@echo off
setlocal ENABLEDELAYEDEXPANSION

cd /d "%~dp0"
set "PORT=5173"
set "URL=http://localhost:%PORT%"
set "SERVER_TITLE=逆水寒排轴本地服务(%PORT%)"

echo [1/4] 检查 Python...
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
echo [2/4] 在新终端窗口启动本地服务...
start "%SERVER_TITLE%" cmd /k "cd /d \"%~dp0\" && echo 本地服务地址：%URL% && echo 按 Ctrl+C 可停止服务。 && %PY_CMD% -m http.server %PORT%"

echo [3/4] 等待服务启动...
timeout /t 1 /nobreak >nul

echo [4/4] 打开浏览器：%URL%
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Process '%URL%'"

echo.
echo 已完成：
echo - 服务终端窗口标题：%SERVER_TITLE%
echo - 停止方式：切到服务终端，按 Ctrl+C，或直接关闭该窗口
exit /b 0
