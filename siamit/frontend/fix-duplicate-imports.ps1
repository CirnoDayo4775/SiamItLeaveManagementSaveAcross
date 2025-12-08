# Fix duplicate logger imports - Simple approach
# Removes all duplicate "import { logger } from '@/lib/logger';" keeping only the first one

$filesFixed = 0
$totalRemoved = 0

$filesToFix = @(
    "src\components\dialogs\LeaveDetailDialog.tsx",
    "src\components\dialogs\SessionExpiredDialog.tsx",
    "src\components\leave\AdminLeaveForm.tsx",
    "src\components\AppSidebar.tsx",
    "src\components\LazyErrorBoundary.tsx",
    "src\config\index.ts",
    "src\contexts\SocketContext.tsx",
    "src\lib\api.ts",
    "src\lib\utils.ts",
    "src\pages\SuperAdmin\LeaveSystemSettings.tsx",
    "src\pages\AnnouncementsFeedPage.tsx",
    "src\pages\ApproveLeave.tsx",
    "src\pages\CompanyCalendarPage.tsx",
    "src\pages\CompanyMonthDetailPage.tsx",
    "src\pages\EmployeeDetail.tsx",
    "src\pages\EmployeeManagement.tsx",
    "src\pages\Index.tsx",
    "src\pages\LeaveHistory.tsx",
    "src\pages\ManagePost.tsx",
    "src\pages\NotFound.tsx",
    "src\pages\Profile.tsx",
    "src\pages\Register.tsx"
)

foreach ($relativePath in $filesToFix) {
    $filePath = $relativePath
    
    if (Test-Path $filePath) {
        $lines = Get-Content $filePath
        $newLines = @()
        $foundFirst = $false
        $removed = 0
        
        foreach ($line in $lines) {
            if ($line -match "import \{ logger \} from '@/lib/logger';") {
                if (-not $foundFirst) {
                    $newLines += $line
                    $foundFirst = $true
                } else {
                    $removed++
                }
            } else {
                $newLines += $line
            }
        }
        
        if ($removed -gt 0) {
            $newLines | Set-Content -Path $filePath
            Write-Host "Fixed: $filePath (removed $removed duplicates)"
            $filesFixed++
            $totalRemoved += $removed
        }
    }
}

Write-Host "`n=== Summary ==="
Write-Host "Files fixed: $filesFixed"
Write-Host "Total duplicates removed: $totalRemoved"
