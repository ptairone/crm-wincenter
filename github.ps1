while ($true) {
    git status
    git add .
    git commit -m "Commit automático"
    git push origin main
    Start-Sleep -Seconds 1
}
