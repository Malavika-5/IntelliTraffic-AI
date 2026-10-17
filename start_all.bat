@echo off
echo ==========================================================
echo  Starting IntelliTraffic AI (Backend + Frontend)
echo ==========================================================
start "IntelliTraffic Backend (Port 8000)" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
start "IntelliTraffic Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Backend running at:  http://localhost:8000 (API Docs: http://localhost:8000/docs)
echo Frontend running at: http://localhost:5173
echo ==========================================================
