#!/bin/bash
# Kill any existing node/vite processes to avoid port conflicts
pkill -f node || true
pkill -f vite || true

# Navigate to project directory
cd /run/media/bielteknik/SDD250/ejderProjects/PLGazoz

# Start the system in development mode
# Note: In a real production, we'd use 'npm start' or serve the 'dist' folder
npm run dev &

# Wait for the server to be ready
echo "Sistem başlatılıyor, lütfen bekleyin..."
sleep 15

# Open Chromium in Kiosk mode (Fullscreen HMI mode)
# --kiosk: Fullscreen without browser UI
# --noerrdialogs: Hide error messages
# --disable-infobars: Hide the "Chromium is being controlled..." bar
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000
