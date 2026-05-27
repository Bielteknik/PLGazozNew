#!/bin/bash

# PLGazoz Raspberry Pi 5 Baslatma Scripti
# Bu betik hem FastAPI backend sunucusunu hem de Vite React on yuzunu es zamanli baslatir.

echo "======================================================================"
echo "      PLGAZOZ ICECEK SISELEME OTOMASYON SISTEMI - RASPBERRY PI 5"
echo "======================================================================"
echo ""

# 1. Backend'i sanal ortam ile baslat
echo " [1/2] Arka Plan (Python FastAPI Backend) baslatiliyor..."
cd src/backend

# Linux/Pi uzerinde venv aktivasyon dizini 'bin/activate' seklindedir
if [ -d "pzoz" ]; then
    source pzoz/bin/activate
    echo "       - pzoz sanal ortami aktif edildi."
else
    echo "       - UYARI: pzoz sanal ortam klasoru bulunamadi! Sistem yerel python ile denenecek."
fi

# Uvicorn'u arka planda calistir ve PID numarasini kaydet
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ../..

# 2. HMI Arayuzunu (Vite) baslat
echo " [2/2] Ön Yüz (Vite React HMI) baslatiliyor..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================================================"
echo "  Sistem Basariyla Baslatildi!"
echo "  - Backend PID: $BACKEND_PID (Port: 8000)"
echo "  - HMI (Vite) PID: $FRONTEND_PID (Port: 3000)"
echo "  - Kapatmak ve tum servisleri durdurmak icin CTRL+C tuşlarina basin."
echo "======================================================================"
echo ""

# Kullanici CTRL+C yaptiginda arka plandaki iki sureci de temiz bir sekilde kapat
trap "echo -e '\n[SYS] Servisler kapatiliyor...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Arka plandaki surecler kapanana kadar ana terminali beklet
wait
