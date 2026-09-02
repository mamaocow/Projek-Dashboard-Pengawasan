$port = 3000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "============================================="
    Write-Host "🚀 SIMAWAS Local Server running at:"
    Write-Host "   👉 http://localhost:$port"
    Write-Host "============================================="
    Write-Host "Press Ctrl+C in terminal to stop the server."
} catch {
    Write-Host "Error starting listener: $_"
    exit 1
}

# Cleanup on exit
register-objectevent -inputobject $listener -eventname "Close" -action { $listener.Stop() } | Out-Null

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawPath = $request.Url.LocalPath
        $path = $rawPath.TrimStart('/')
        
        Write-Host "$($request.Method) $rawPath"

        # Handle API routes
        if ($rawPath.StartsWith("/api/data")) {
            $dataPath = Join-Path (Get-Location) "data/data.json"
            if (Test-Path $dataPath) {
                $buffer = [System.IO.File]::ReadAllBytes($dataPath)
                $response.ContentLength64 = $buffer.Length
                $response.ContentType = "application/json; charset=utf-8"
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"error": "data.json not found"}')
                $response.ContentLength64 = $buffer.Length
                $response.ContentType = "application/json"
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
        } 
        elseif ($rawPath.StartsWith("/api/submit") -or $rawPath.StartsWith("/api/update-status") -or $rawPath.StartsWith("/api/delete")) {
            $response.ContentType = "application/json"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"success": true, "message": "Mocked local API success"}')
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        else {
            # Handle Static Files
            if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
            $filePath = Join-Path (Get-Location) $path
            
            if (Test-Path $filePath -PathType Leaf) {
                $buffer = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $buffer.Length
                
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = "application/octet-stream"
                switch ($ext) {
                    ".html" { $mime = "text/html; charset=utf-8" }
                    ".css"  { $mime = "text/css; charset=utf-8" }
                    ".js"   { $mime = "application/javascript; charset=utf-8" }
                    ".json" { $mime = "application/json; charset=utf-8" }
                    ".png"  { $mime = "image/png" }
                    ".jpg"  { $mime = "image/jpeg" }
                    ".svg"  { $mime = "image/svg+xml" }
                    ".ico"  { $mime = "image/x-icon" }
                }
                $response.ContentType = $mime
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
        }
        $response.Close()
    } catch {
        # Handle exceptions gracefully
        if ($listener.IsListening) {
            Write-Host "Request handling error: $_"
        }
    }
}
