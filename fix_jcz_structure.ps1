param(
  [string]$Path
)
$enc = New-Object System.Text.UTF8Encoding($false)
$c = [System.IO.File]::ReadAllText($Path,$enc)
$nl = "`r`n"

$pat1='\}\s*,\s*\r?\n\s*"artifacts"\s*:'
if(([regex]::Matches($c,$pat1)).Count -ne 1){ throw 'Unexpected artifacts anchor count for pat1' }
$rep1 = ',' + $nl + '      "artifacts":'
$c = [regex]::Replace($c,$pat1,$rep1,1)

$pat2='\]\s*\r?\n\}\s*\r?\n\s*\{\s*\r?\n\s*"path_id"\s*:\s*2\s*,'
if(([regex]::Matches($c,$pat2)).Count -ne 1){ throw 'Unexpected path2 bridge count for pat2' }
$rep2 = ']' + $nl + '    },' + $nl + '    {' + $nl + '      "path_id": 2,'
$c = [regex]::Replace($c,$pat2,$rep2,1)

$pat3='("sections"\s*:\s*\[\s*\{\s*)("text"\s*:)' 
if(([regex]::Matches($c,$pat3)).Count -ne 1){ throw 'Unexpected sections insert point count for pat3' }
$rep3 = '$1"section_title": "文物说明",' + $nl + '     $2'
$c = [regex]::Replace($c,$pat3,$rep3,1)

$art = [regex]::Match($c,'"artifacts"\s*:\s*\[')
if(-not $art.Success){ throw 'artifacts not found' }
$artStart = $art.Index
$path2 = [regex]::Match($c,'"path_id"\s*:\s*2\s*,')
if(-not $path2.Success){ throw 'path 2 not found' }
$artBlock = $c.Substring($artStart, $path2.Index - $artStart)
$txt = [regex]::Match($artBlock,'"text"\s*:\s*"(?<v>(?:[^"\\]|\\.)*)"',[System.Text.RegularExpressions.RegexOptions]::Singleline)
if(-not $txt.Success){ throw 'artifact text string not found' }
$v = $txt.Groups['v'].Value
$v2 = [regex]::Replace($v,'\r?\n','\\n\\n')
if($v2 -ne $v){
  $artBlock2 = $artBlock.Substring(0,$txt.Groups['v'].Index) + $v2 + $artBlock.Substring($txt.Groups['v'].Index + $txt.Groups['v'].Length)
  $c = $c.Substring(0,$artStart) + $artBlock2 + $c.Substring($path2.Index)
}

$pat5='\]\s*\r?\n\}\s*\r?\n```\s*$'
if(([regex]::Matches($c,$pat5)).Count -ne 1){ throw 'Unexpected ending pattern count for pat5' }
$rep5 = ']' + $nl + '  }' + $nl + '};' + $nl + '```'
$c = [regex]::Replace($c,$pat5,$rep5,1)

[System.IO.File]::WriteAllText($Path,$c,$enc)

$all = [System.IO.File]::ReadAllText($Path,$enc)
$pathIds = [regex]::Matches($all,'"path_id"\s*:\s*(\d+)\s*,') | ForEach-Object { [int]$_.Groups[1].Value }
$choices3 = [regex]::Matches($all,'"choices"\s*:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]') | ForEach-Object { "$($_.Groups[1].Value)|$($_.Groups[2].Value)|$($_.Groups[3].Value)" }
$artPerPath = [regex]::Matches($all,'"path_id"\s*:\s*(\d+)\s*,(?:(?!"path_id").)*?"artifacts"\s*:\s*\[(?<arr>.*?)\]',[System.Text.RegularExpressions.RegexOptions]::Singleline) | ForEach-Object {
  $pathIdValue=[int]$_.Groups[1].Value
  $arr=$_.Groups['arr'].Value
  $nonEmpty=([regex]::IsMatch($arr,'\S'))
  [pscustomobject]@{path_id=$pathIdValue;non_empty=$nonEmpty}
}

Write-Output 'OK'
Write-Output "paths_count=$($pathIds.Count)"
Write-Output "path_ids=$([string]::Join(',', $pathIds))"
Write-Output "choices_count=$($choices3.Count)"
Write-Output "choices_unique=$((@($choices3 | Sort-Object -Unique)).Count)"
Write-Output "artifacts_blocks=$($artPerPath.Count)"
Write-Output "artifacts_non_empty_path_ids=$([string]::Join(',', @($artPerPath | Where-Object {$_.non_empty} | ForEach-Object {$_.path_id})))"
