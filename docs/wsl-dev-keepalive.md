# WSL 상시 유지(keepalive) — 유휴 자동 종료 대처

WSL2는 Windows 쪽 `wsl.exe` 세션(터미널 창)이 전부 닫히면 기본 ~60초(`vmIdleTimeout`) 후 VM을 **정상 종료**한다. 리눅스 내부의 tmux·sshd·systemd 서비스·외부에서 붙은 Tailscale ssh/mosh 접속은 이 유휴 판정을 막지 못한다. VM이 내려가면 transient로 띄운 dev 서버와 tmux 세션이 통째로 사라져 "WSL이 자주 꺼진다"로 체감된다.

## 진단법 (2026-07-07 실사례)

크래시/OOM과 유휴 종료를 구분하는 법:

```bash
journalctl --list-boots            # 부팅 이력 — 짧은 부팅이 반복되는지
journalctl -b -1 -n 10             # 직전 부팅의 끝 — systemd poweroff 시퀀스가
                                   # 완결돼 있으면 정상 종료(유휴/수동), 뚝 끊겼으면 크래시
```

Windows 쪽 대조(호스트 재부팅/절전 여부 — 인터롭은 **전체 경로** 필요):

```bash
/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command \
  "Get-WinEvent -FilterHashtable @{LogName='System'; Id=1074,6005,6006,6008,42,107} -MaxEvents 60"
```

저널이 완결된 poweroff + 호스트 전원 이벤트 없음 = **유휴 자동 종료** 확정.

## 설치

`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\wsl-keepalive.vbs` 로 저장 (로그온 시 자동 실행, 관리자 권한 불필요):

```vbs
' WSL VM 상시 유지: 숨김 wsl.exe 세션 하나를 로그온 시 열어둔다.
' 이 세션이 살아 있는 동안 WSL 유휴 자동 종료(vmIdleTimeout)가 발동하지 않는다.
' 해제: 이 파일 삭제 + 작업관리자에서 해당 wsl.exe 종료(또는 wsl --shutdown).
CreateObject("Wscript.Shell").Run "C:\Windows\System32\wsl.exe --exec sleep infinity", 0, False
```

즉시 적용(재로그온 없이):

```bash
cd /mnt/c && /mnt/c/Windows/System32/wscript.exe \
  'C:\Users\<사용자>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\wsl-keepalive.vbs'
```

## 검증

```bash
pgrep -af 'sleep infinity'   # keepalive 세션이 리눅스 쪽에 보이면 성공
```

## 해제

Startup 폴더의 `wsl-keepalive.vbs` 삭제 후 `wsl --shutdown` 한 번.

## 주의

- keepalive 동안 WSL이 호스트 RAM을 계속 점유한다(`.wslconfig`의 `memory` 캡 및 `autoMemoryReclaim=gradual`로 유휴 시 점진 반환). 배터리 사용이 잦으면 그때만 해제 권장.
- dev 서버(wl-web/wl-api)는 의도적으로 상시화하지 않는다 — 필요할 때 cgroup 캡 transient로 띄운다(`systemd-run --user` 패턴, [로컬 개발 가이드](../web/docs/local-dev-after-clone-guide.md) 참고).
