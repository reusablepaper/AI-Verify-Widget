import type { BrowserWindow } from 'electron'

export interface PinKeepAliveHandle {
  stop: () => void
}

/**
 * Windows에서는 화면 잠금/절전 복귀, 알림 토스트 등으로 "항상 위" 창이 topmost
 * 그룹 안에서 뒤로 밀려나는 경우가 있다(OS 차원의 z-order 드리프트 — 플래그 자체는
 * 꺼지지 않지만 실제로는 다른 창 뒤에 깔림). 핀이 켜져 있고 창이 보이는 동안만
 * 주기적으로 setAlwaysOnTop을 재호출해 맨 앞으로 되돌린다.
 */
export function startPinKeepAlive(
  win: BrowserWindow,
  isPinned: () => boolean,
  intervalMs = 4000
): PinKeepAliveHandle {
  const timer = setInterval(() => {
    if (win.isDestroyed()) return
    if (!isPinned() || !win.isVisible()) return
    win.setAlwaysOnTop(true, 'floating')
  }, intervalMs)
  return { stop: () => clearInterval(timer) }
}
