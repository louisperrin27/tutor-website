# Fix all relative paths to absolute paths in HTML files
$files = @(
    'further_maths.html',
    'alevel_maths.html',
    'alevel_physics.html',
    'alevel_further_maths.html',
    'contact.html',
    'tutoring.html',
    'continue.html',
    'account.html',
    'free-content.html',
    'mailing-list.html',
    'login.html',
    'forgot-password.html',
    'reset-password.html',
    'singup.html',
    'confirmation.html',
    'my-bookings.html',
    'payment.html',
    'calendar.html',
    'free_session.html',
    'group_booking.html',
    'tutoring_booking.html',
    'admin.html',
    'admin-home.html',
    'admin-login.html',
    'admin-mailing-list.html',
    'a-level-tutoring-packages.html',
    'gcse-tutoring-packages.html'
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $original = $content
        
        # Fix CSS paths
        $content = $content -replace 'href="styles\.css"', 'href="/styles.css"'
        $content = $content -replace "href='styles\.css'", "href='/styles.css'"
        
        # Fix JS paths (but not external URLs)
        $content = $content -replace 'src="([^/h][^t][^t][^p].*?\.js")', 'src="/$1'
        $content = $content -replace "src='([^/h][^t][^t][^p].*?\.js')", "src='/$1"
        
        if ($content -ne $original) {
            Set-Content $file $content -NoNewline
            Write-Host "Fixed: $file" -ForegroundColor Green
        }
    }
}

Write-Host "Done!" -ForegroundColor Cyan
