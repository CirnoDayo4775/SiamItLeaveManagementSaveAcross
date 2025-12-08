# Console Cleanup Script
# This PowerShell script replaces console.log/error/warn with logger utility

$files = Get-ChildItem -Path "src" -Include "*.ts","*.tsx" -Recurse

$replacements = @(
    @{
        Pattern = 'console\.log\('
        Replacement = 'logger.debug('
    },
    @{
        Pattern = 'console\.error\('
        Replacement = 'logger.error('
    },
    @{
        Pattern = 'console\.warn\('
        Replacement = 'logger.warn('
    }
)

$modifiedFiles = @()

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $modified = $false
    
    foreach ($replacement in $replacements) {
        if ($content -match $replacement.Pattern) {
            $content = $content -replace $replacement.Pattern, $replacement.Replacement
            $modified = $true
        }
    }
    
    if ($modified) {
        # Check if file already imports logger
        if ($content -notmatch "import.*logger.*from.*@/lib/logger") {
            # Add import at the top (after other imports)
            $importStatement = "import { logger } from '@/lib/logger';`n"
            
            # Find the last import statement
            if ($content -match "(?s)(import.*?;)\s*\n\s*\n") {
                $content = $content -replace "(?s)(import.*?;)\s*\n\s*\n", "`$1`n$importStatement`n"
            } else {
                $content = $importStatement + $content
            }
        }
        
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $modifiedFiles += $file.FullName
        Write-Host "Modified: $($file.FullName)"
    }
}

Write-Host "`n=== Summary ==="
Write-Host "Total files modified: $($modifiedFiles.Count)"
Write-Host "`nModified files:"
$modifiedFiles | ForEach-Object { Write-Host "  $_" }
