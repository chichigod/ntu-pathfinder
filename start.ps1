# 一鍵啟動 NTU PathFinder（後端 FastAPI + 前端 Vite）
# 使用方式：在專案根目錄執行  powershell -ExecutionPolicy Bypass -File .\start.ps1
$root = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
