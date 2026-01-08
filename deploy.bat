@echo off
echo ==========================================
echo      Deploying to GitHub Pages
echo ==========================================

echo 1. Installing dependencies...
call npm install

echo 2. Building project...
call npm run build

echo 3. Deploying to gh-pages branch...
call npx gh-pages -d dist

echo ==========================================
echo      Deployment Complete!
echo      URL: https://kittyboy06.github.io/Attendence/
echo ==========================================
pause
