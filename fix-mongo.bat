@echo off
:: Vérifier les droits administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    :: Relancer avec droits admin sans demander confirmation
    powershell -Command "Start-Process '%~f0' -Verb RunAs -WindowStyle Hidden"
    exit /b
)

:: Vérifier l'état du service MongoDB
sc query MongoDB | find "RUNNING" >nul
if %errorlevel% equ 0 (
    :: MongoDB fonctionne déjà, quitter silencieusement
    exit /b
)

:: MongoDB n'est pas démarré, lancer la réparation
net stop MongoDB 2>nul

del "C:\Program Files\MongoDB\Server\6.0\data\mongod.lock" /F /Q 2>nul

del "C:\Program Files\MongoDB\Server\6.0\data\diagnostic.data\*.interim" /F /Q 2>nul

"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\Program Files\MongoDB\Server\6.0\data" --repair >nul 2>&1

net start MongoDB >nul 2>&1

:: Fermer automatiquement la console
exit