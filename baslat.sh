#!/bin/bash

# PLGazoz Akıllı Başlatıcı

echo "------------------------------------------"
echo "   PLGAZOZ SCADA SİSTEMİ BAŞLATILIYOR     "
echo "------------------------------------------"

# 1. Backend'i Arka Planda Başlat
echo "[1/2] Python Backend başlatılıyor..."
source backend/pzoz/bin/activate
cd backend
python3 main.py &
BACKEND_PID=$!
cd ..

# 2. Frontend'i Başlat
echo "[2/2] React Arayüzü başlatılıyor..."
if [ ! -d "node_modules" ]; then
    echo "UYARI: node_modules bulunamadı! 'npm install' komutunu çalıştırmanız gerekebilir."
fi
npx vite --port=3000 --host=0.0.0.0 &
FRONTEND_PID=$!

echo "------------------------------------------"
echo "SİSTEM AKTİF! Durdurmak için CTRL+C yapın."
echo "------------------------------------------"

# CTRL+C yapıldığında her şeyi kapat
cleanup() {
    echo ""
    echo "Sistem kapatılıyor..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

trap cleanup SIGINT

# Süreçleri açık tut
wait
