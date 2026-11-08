@echo off
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is required on this computer.
  echo Install Node.js, then run: npm install -g pnpm
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing app dependencies...
  call pnpm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo.
echo THE CONNOISSEUR - IPHONE TEST
echo 1. Put this computer and the iPhone on the same Wi-Fi network.
echo 2. Install Expo Go from the iPhone App Store.
echo 3. Scan the QR code below with the iPhone Camera app.
echo 4. Keep this window open while testing.
echo.

call pnpm start:iphone
endlocal
