# Simple local web server for Jarvis HUD (nothing to install).
# Run:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8765 in Chrome or Edge.
#
# Homey: requests to /homey/<path> are forwarded to <url>/api/<path> on your Homey,
# using the API key in homey.config.json. The key never reaches the browser.
#
# Claude: requests to /claude/messages are forwarded to the Claude API with the key from
# claude.config.json (or the ANTHROPIC_API_KEY environment variable). The key never reaches the browser.
param([int]$Port = 8765, [string]$Config = "", [string]$ClaudeConfig = "", [string]$ClaudeBase = "https://api.anthropic.com")

$root = $PSScriptRoot
$configFile = if ($Config) { [IO.Path]::GetFullPath($Config) } else { Join-Path $root "homey.config.json" }
$claudeFile = if ($ClaudeConfig) { [IO.Path]::GetFullPath($ClaudeConfig) } else { Join-Path $root "claude.config.json" }
$claudeVersion = "2026-10-21"
$claudeBeta = "server-side-fallback-2026-07-01"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13 }
catch { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 }
$types = @{ ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"; ".js" = "application/javascript; charset=utf-8"; ".json" = "application/json; charset=utf-8"; ".png" = "image/png"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon" }
# Only these Homey API areas can be reached through the proxy.
$allowed = '^manager/(devices/device|zones/zone|flow/flow|flow/advancedflow)(/|$)'

function Send-Text($res, [int]$status, [string]$body, [string]$type = "application/json; charset=utf-8") {
  $res.StatusCode = $status
  $res.ContentType = $type
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Get-HomeyConfig {
  if (-not (Test-Path $configFile)) { return $null }
  try { $cfg = [IO.File]::ReadAllText($configFile, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch { return $null }
  if (-not $cfg.url -or -not $cfg.token -or $cfg.token -like "KLISTRA*") { return $null }
  return $cfg
}

# Tries a request against Homey. Returns "ok", "unauthorized" or "unreachable".
function Test-Homey([string]$url, [string]$token) {
  try {
    $wr = [System.Net.HttpWebRequest]::Create($url.TrimEnd("/") + "/api/manager/zones/zone")
    $wr.Timeout = 6000
    $wr.Headers.Add("Authorization", "Bearer " + $token)
    $r = $wr.GetResponse(); $r.Close()
    return "ok"
  } catch {
    $ex = $_.Exception
    while ($ex -and -not ($ex -is [System.Net.WebException])) { $ex = $ex.InnerException }
    if ($ex -and $ex.Response) {
      $code = [int]$ex.Response.StatusCode; $ex.Response.Close()
      if ($code -eq 401 -or $code -eq 403) { return "unauthorized" }
      return "http $code"
    }
    return "unreachable"
  }
}

# POST /homey/setup {url, token}: tests the connection and saves homey.config.json.
# An empty token keeps the saved one (used when only the IP changes). DELETE removes the config.
function Invoke-HomeySetup($ctx) {
  $req = $ctx.Request; $res = $ctx.Response
  if ($req.HttpMethod -eq "DELETE") {
    if (Test-Path $configFile) { Remove-Item $configFile -Force }
    Write-Host "Homey: disconnected"
    Send-Text $res 200 '{"ok":true}'
    return
  }
  if ($req.HttpMethod -ne "POST") { Send-Text $res 405 '{"error":"method"}'; return }
  try { $body = (New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd() | ConvertFrom-Json }
  catch { Send-Text $res 400 '{"error":"bad json"}'; return }

  $url = ([string]$body.url).Trim()
  if ($url -and $url -notmatch '^https?://') { $url = "http://" + $url }
  $url = $url.TrimEnd("/")
  if ($url -notmatch '^https?://[A-Za-z0-9.\-]+(:\d+)?$') { Send-Text $res 400 '{"error":"bad url"}'; return }

  $token = ([string]$body.token).Trim()
  if (-not $token) { $old = Get-HomeyConfig; if ($old) { $token = $old.token } }
  if (-not $token) { Send-Text $res 400 '{"error":"no token"}'; return }

  $result = Test-Homey $url $token
  if ($result -ne "ok") { Send-Text $res 400 ('{"error":"' + $result + '"}'); return }

  $json = @{ url = $url; token = $token } | ConvertTo-Json
  [IO.File]::WriteAllText($configFile, $json, (New-Object Text.UTF8Encoding $false))
  Write-Host "Homey: connected to $url"
  Send-Text $res 200 ('{"ok":true,"url":"' + $url + '"}')
}

# ---------------- Claude ----------------
function Get-ClaudeKey {
  if (Test-Path $claudeFile) {
    try { $c = [IO.File]::ReadAllText($claudeFile, [Text.Encoding]::UTF8) | ConvertFrom-Json; if ($c.key) { return @{ key = $c.key; source = "file" } } } catch {}
  }
  if ($env:ANTHROPIC_API_KEY) { return @{ key = $env:ANTHROPIC_API_KEY; source = "env" } }
  return $null
}

function New-ClaudeRequest([string]$path, [string]$method, [string]$key) {
  $wr = [System.Net.HttpWebRequest]::Create($ClaudeBase.TrimEnd("/") + $path)
  $wr.Method = $method
  $wr.Timeout = 180000
  $wr.ReadWriteTimeout = 180000
  $wr.Headers.Add("x-api-key", $key)
  $wr.Headers.Add("anthropic-version", $claudeVersion)
  return $wr
}

# Sends $wr and copies the answer to the browser. Returns nothing.
function Send-Upstream($wr, $res, [byte[]]$body) {
  if ($body) {
    $wr.ContentType = "application/json"
    $out = $wr.GetRequestStream(); $out.Write($body, 0, $body.Length); $out.Close()
  }
  $resp = $null
  try { $resp = $wr.GetResponse() }
  catch {
    $ex = $_.Exception
    while ($ex -and -not ($ex -is [System.Net.WebException])) { $ex = $ex.InnerException }
    if ($ex -and $ex.Response) { $resp = $ex.Response }
    else { Send-Text $res 502 '{"error":"unreachable"}'; return }
  }
  $res.StatusCode = [int]$resp.StatusCode
  $res.ContentType = "application/json; charset=utf-8"
  $s = $resp.GetResponseStream(); $s.CopyTo($res.OutputStream); $resp.Close()
}

function Invoke-ClaudeProxy($ctx, [string]$sub) {
  $req = $ctx.Request; $res = $ctx.Response
  $k = Get-ClaudeKey

  if ($sub -eq "status") {
    if ($k) { Send-Text $res 200 ('{"configured":true,"source":"' + $k.source + '"}') }
    else { Send-Text $res 200 '{"configured":false}' }
    return
  }
  if ($req.Headers["X-Jarvis"] -ne "1") { Send-Text $res 403 '{"error":"forbidden"}'; return }

  if ($sub -eq "setup") {
    if ($req.HttpMethod -eq "DELETE") {
      if (Test-Path $claudeFile) { Remove-Item $claudeFile -Force }
      Write-Host "Claude: key removed"
      Send-Text $res 200 '{"ok":true}'
      return
    }
    try { $body = (New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd() | ConvertFrom-Json }
    catch { Send-Text $res 400 '{"error":"bad json"}'; return }
    $key = ([string]$body.key).Trim()
    if ($key -notmatch '^[A-Za-z0-9_\-]{20,}$') { Send-Text $res 400 '{"error":"bad key"}'; return }
    # Validate the key with the free Models endpoint before saving.
    try {
      $r = (New-ClaudeRequest "/v1/models?limit=1" "GET" $key).GetResponse(); $r.Close()
    } catch {
      $ex = $_.Exception
      while ($ex -and -not ($ex -is [System.Net.WebException])) { $ex = $ex.InnerException }
      $code = if ($ex -and $ex.Response) { [int]$ex.Response.StatusCode } else { 0 }
      $err = if ($code -eq 401 -or $code -eq 403) { "unauthorized" } elseif ($code) { "http $code" } else { "unreachable" }
      Send-Text $res 400 ('{"error":"' + $err + '"}'); return
    }
    [IO.File]::WriteAllText($claudeFile, (@{ key = $key } | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
    Write-Host "Claude: key saved"
    Send-Text $res 200 '{"ok":true}'
    return
  }

  if ($sub -eq "messages" -and $req.HttpMethod -eq "POST") {
    if (-not $k) { Send-Text $res 503 '{"error":"not configured"}'; return }
    $ms = New-Object IO.MemoryStream; $req.InputStream.CopyTo($ms)
    $wr = New-ClaudeRequest "/v1/messages" "POST" $k.key
    # Only models that support server-side fallback get the beta header (Haiku does not).
    if ($req.Headers["X-Claude-Fallback"] -eq "1") { $wr.Headers.Add("anthropic-beta", $claudeBeta) }
    Send-Upstream $wr $res $ms.ToArray()
    return
  }
  Send-Text $res 404 '{"error":"not found"}'
}

function Invoke-HomeyProxy($ctx, [string]$sub) {
  $req = $ctx.Request; $res = $ctx.Response
  $cfg = Get-HomeyConfig

  if ($sub -eq "status") {
    if ($cfg) { Send-Text $res 200 ('{"configured":true,"url":"' + $cfg.url + '"}') }
    else { Send-Text $res 200 '{"configured":false}' }
    return
  }
  # Custom header forces a CORS preflight, so other websites cannot call the proxy.
  if ($req.Headers["X-Jarvis"] -ne "1") { Send-Text $res 403 '{"error":"forbidden"}'; return }
  if ($sub -eq "setup") { Invoke-HomeySetup $ctx; return }
  if (-not $cfg) { Send-Text $res 503 '{"error":"not configured"}'; return }
  if ($sub -notmatch $allowed) { Send-Text $res 403 '{"error":"path not allowed"}'; return }

  $target = $cfg.url.TrimEnd("/") + "/api/" + $sub + $req.Url.Query
  $wr = [System.Net.HttpWebRequest]::Create($target)
  $wr.Method = $req.HttpMethod
  $wr.Timeout = 10000
  $wr.Headers.Add("Authorization", "Bearer " + $cfg.token)
  if ($req.HasEntityBody) {
    $wr.ContentType = "application/json"
    $out = $wr.GetRequestStream(); $req.InputStream.CopyTo($out); $out.Close()
  }
  $resp = $null
  try { $resp = $wr.GetResponse() }
  catch {
    $ex = $_.Exception
    while ($ex -and -not ($ex -is [System.Net.WebException])) { $ex = $ex.InnerException }
    if ($ex -and $ex.Response) { $resp = $ex.Response }
    else { Send-Text $res 502 ('{"error":"unreachable","url":"' + $cfg.url + '"}'); return }
  }
  $res.StatusCode = [int]$resp.StatusCode
  $res.ContentType = "application/json; charset=utf-8"
  $s = $resp.GetResponseStream(); $s.CopyTo($res.OutputStream); $resp.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Jarvis HUD: http://localhost:$Port  (Ctrl+C to stop)"
if (Get-HomeyConfig) { Write-Host "Homey: configured" } else { Write-Host "Homey: not configured" }
if (Get-ClaudeKey) { Write-Host "Claude: configured" } else { Write-Host "Claude: not configured" }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $res.AddHeader("Cache-Control", "no-store")
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ($path.StartsWith("homey/")) {
      Invoke-HomeyProxy $ctx $path.Substring(6)
      continue
    }
    if ($path.StartsWith("claude/")) {
      Invoke-ClaudeProxy $ctx $path.Substring(7)
      continue
    }
    if ($path -eq "") { $path = "index.html" }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    $secret = $file -eq $configFile -or $file -eq $claudeFile -or $file -like "*.config.json"
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf) -and -not $secret) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]
      if (-not $ct) { $ct = "application/octet-stream" }
      $res.ContentType = $ct
      if ($ctx.Request.HttpMethod -ne "HEAD") {
        $bytes = [IO.File]::ReadAllBytes($file)
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } else {
      $res.StatusCode = 404
    }
  } catch {
    Write-Host "Error: $($_.Exception.Message)"
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
