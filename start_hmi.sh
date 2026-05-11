#!/bin/bash
# Set paths to ensure npm and node are found
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

# Kill existing processes
pkill -f node || true
pkill -f vite || true

# Direct path to the project
PROJECT_PATH="/home/bielteknik/PLGazozNew"
cd "$PROJECT_PATH"

# Startup message
echo "Palandöken Gazoz HMI Başlatılıyor..."

# Run development server
echo "Frontend başlatılıyor..."
npm run dev &

# Run backend
echo "Backend başlatılıyor..."
cd backend && source pzoz/bin/activate && python3 main.py &
cd ..

# Wait for readiness
echo "Servislerin ayağa kalkması bekleniyor (15 sn)..."
sleep 15

# Launch Chromium in Kiosk mode
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000
