#!/bin/bash
cd "$(dirname "$0")"
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 1
open -a Safari "http://localhost:8000/index.html"
echo "Server running at http://localhost:8000"
echo "Press Ctrl+C to stop the server"
wait $SERVER_PID
