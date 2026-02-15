# Fix all relative HTML links to absolute paths
$files = @(
    'my-bookings.html',
    'confirmation.html',
    'reset-password.html',
    'forgot-password.html',
    'login.html',
    'free-content.html',
    'account.html',
    'continue.html',
    'tutoring.html',
    'gcse-tutoring-packages.html',
    'a-level-tutoring-packages.html'
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $original = $content
        
        # Fix relative HTML links (but not external URLs or anchors)
        # Pattern: href="filename.html" but not href="http" or href="#"
        $content = $content -replace 'href="([^/h#][^t][^t][^p].*?\.html")', 'href="/$1'
        $content = $content -replace "href='([^/h#][^t][^t][^p].*?\.html')", "href='/$1"
        
        if ($content -ne $original) {
            Set-Content $file $content -NoNewline
            Write-Host "Fixed: $file" -ForegroundColor Green
        }
    }
}

Write-Host "Done!" -ForegroundColor Cyan
