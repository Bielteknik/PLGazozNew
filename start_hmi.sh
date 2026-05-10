#!/bin/bash
# Set paths to ensure npm and node are found
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

# Kill existing processes
pkill -f node || true
pkill -f vite || true

# Direct path to the project
PROJECT_PATH="/run/media/bielteknik/SDD250/ejderProjects/PLGazoz"
cd "$PROJECT_PATH"

# Startup message
echo "Palandöken Gazoz HMI Başlatılıyor..."

# Run development server
# Using absolute path for npm might be safer
npm run dev &

# Wait for readiness
echo "Servislerin ayağa kalkması bekleniyor (15 sn)..."
sleep 15

# Launch Chromium in Kiosk mode
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000
