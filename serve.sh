#!/bin/bash
# Quick local server — access from phone on same WiFi
# Your phone can reach this at http://<your-mac-ip>:8080
echo "Starting Execution Engine on http://localhost:8080"
echo "Phone access: http://$(ipconfig getifaddr en0 2>/dev/null || echo 'your-ip'):8080"
echo "Press Ctrl+C to stop"
cd "$(dirname "$0")"
python3 -m http.server 8080
