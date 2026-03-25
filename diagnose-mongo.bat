@echo off
echo ===== DIAGNOSTIC MONGODB =====
echo.

echo 1. Statut du service:
sc query MongoDB
echo.

echo 2. Dernières lignes du log:
powershell "Get-Content 'C:\Program Files\MongoDB\Server\6.0\log\mongod.log' -Tail 20"
echo.

echo 3. Fichiers dans dbPath:
dir "C:\Program Files\MongoDB\Server\6.0\data"
echo.

echo 4. Verification du port 27017:
netstat -ano | findstr :27017
echo.

pause