@echo off
title PLGazoz Baslatma Scripti
color 0B
cls

echo ======================================================================
echo          PLGAZOZ ICECEK SISELEME OTOMASYON SISTEMI ARAYUZU
echo ======================================================================
echo.
echo  [1/2] Arka Plan (Python FastAPI Backend) baslatiliyor...
echo        - Sanal Ortam: pzoz (Aktif ediliyor)
echo        - Port: 8000
echo.
start cmd /k "title PLGazoz Backend Server && cd src\backend && .\pzoz\Scripts\Activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo  [2/2] Ön Yüz (Vite React HMI) baslatiliyor...
echo        - Adres: http://localhost:3000
echo        - Port: 3000
echo.
start cmd /k "title PLGazoz Frontend HMI && npm run dev"

echo.
echo ======================================================================
echo  Baslatma Komutlari Gonderildi!
echo  - Backend loglarini siyah ekrandan izleyebilirsiniz.
echo  - Tarayicinizda http://localhost:3000 adresini acabilirsiniz.
echo ======================================================================
echo.
pause
