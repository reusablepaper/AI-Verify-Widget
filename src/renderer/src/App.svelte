<script lang="ts">
  import type { ProductView } from '../../main/productsService'
  import type { AppSettings, PaletteId } from '../../main/data/settingsStore'
  import type { ActionOption } from './lib/actions'
  import CardList from './lib/components/CardList.svelte'

  const PALETTE_OPTIONS: { id: PaletteId; label: string }[] = [
    { id: 'default', label: '기본 (핑크·블루·퍼플)' },
    { id: 'ocean', label: '오션' },
    { id: 'mint', label: '민트' },
    { id: 'sky', label: '스카이' },
    { id: 'dusk', label: '더스크' },
    { id: 'rose', label: '로즈' },
  ]

  let products = $state<ProductView[]>([])
  let settings = $state<AppSettings>({ pinned: false, autoLaunch: false, palette: 'default' })
  let authConnected = $state(false)
  let syncing = $state(false)
  let settingsOpen = $state(false)
  let connecting = $state(false)
  let loadError = $state<string | null>(null)
  let scrollAreaEl: HTMLDivElement | undefined = $state()

  // 창 안 어디서 휠을 돌려도 동일하게 스크롤되도록 직접 처리한다.
  // (중첩된 요소 위에서만 네이티브 스크롤이 먹는 경우가 있어 이걸로 통일한다.)
  $effect(() => {
    function handleWheel(e: WheelEvent): void {
      if (!scrollAreaEl) return
      scrollAreaEl.scrollTop += e.deltaY
      e.preventDefault()
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  })

  // 기본 팔레트는 OS 라이트/다크 설정을 그대로 따르고, 그 외 팔레트를 고르면
  // 항상 해당 팔레트의 라이트 배색으로 고정한다(다크모드 자동전환과 겹치지 않도록).
  $effect(() => {
    const root = document.documentElement
    if (settings.palette === 'default') {
      delete root.dataset.palette
      delete root.dataset.theme
    } else {
      root.dataset.palette = settings.palette
      root.dataset.theme = 'light'
    }
  })

  $effect(() => {
    window.api.getProducts().then((p) => (products = p)).catch((e) => (loadError = String(e)))
    window.api.getSettings().then((s) => (settings = s)).catch((e) => (loadError = String(e)))
    window.api
      .getAuthStatus()
      .then((s) => (authConnected = s.connected))
      .catch((e) => (loadError = String(e)))
    const unsubscribe = window.api.onProductsUpdated((p) => (products = p))
    return unsubscribe
  })

  async function refresh(): Promise<void> {
    if (!authConnected) return
    syncing = true
    try {
      await window.api.refreshNow()
    } finally {
      syncing = false
    }
  }

  async function connectGoogle(): Promise<void> {
    connecting = true
    loadError = null
    try {
      const result = await window.api.startGoogleAuth()
      authConnected = result.connected
      if (authConnected) await refresh()
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e)
    } finally {
      connecting = false
    }
  }

  async function togglePin(): Promise<void> {
    const next = !settings.pinned
    settings = { ...settings, pinned: next }
    await window.api.setSetting('pinned', next)
  }

  async function toggleAutoLaunch(): Promise<void> {
    const next = !settings.autoLaunch
    settings = { ...settings, autoLaunch: next }
    await window.api.setSetting('autoLaunch', next)
  }

  async function changePalette(id: PaletteId): Promise<void> {
    settings = { ...settings, palette: id }
    await window.api.setSetting('palette', id)
  }

  function handleAction(id: string, action: ActionOption, note?: string): void {
    if (action.kind === 'confirmExclude') {
      void window.api.confirmExclude(id)
      return
    }
    if (action.kind === 'mainAdvance') {
      void window.api.appendHistoryEntry(id, action.type, { note })
      return
    }
    if (action.kind === 'mainResume') {
      void window.api.appendHistoryEntry(id, 'main:resume', { note })
      return
    }
    if (action.kind === 'evidenceReopen') {
      void window.api.appendHistoryEntry(id, 'stage:evidence_reopen', { note })
      return
    }
    const typeMap = {
      interruptOpen: 'interrupt:open',
      interruptReceived: 'interrupt:received',
      interruptClose: 'interrupt:close',
      interruptReopen: 'interrupt:reopen',
    } as const
    void window.api.appendHistoryEntry(id, typeMap[action.kind], {
      note,
      taskKind: action.taskKind,
      round: action.round,
    })
  }
</script>

<div class="app-shell">
  <header class="titlebar">
    <span class="app-title">AI 확인제 진행현황</span>
    <div class="controls">
      <button class="ctrl" title="새로고침" aria-label="새로고침" disabled={syncing} onclick={refresh}>
        <span class:spin={syncing}>⟳</span>
      </button>
      <button
        class="ctrl"
        class:active={settings.pinned}
        title={settings.pinned ? '고정 해제' : '항상 위에 고정'}
        aria-label={settings.pinned ? '고정 해제' : '항상 위에 고정'}
        onclick={togglePin}
      >
        📌
      </button>
      <button class="ctrl" title="설정" aria-label="설정" onclick={() => (settingsOpen = !settingsOpen)}>⚙</button>
      <button class="ctrl" title="숨기기" aria-label="숨기기" onclick={() => window.api.hideWindow()}>×</button>
    </div>
  </header>

  <div class="scroll-area" bind:this={scrollAreaEl}>
    {#if settingsOpen}
      <div class="settings-panel">
        <label class="row">
          <span>PC 켤 때 자동 실행</span>
          <input type="checkbox" checked={settings.autoLaunch} onchange={toggleAutoLaunch} />
        </label>
        <label class="row">
          <span>색상 테마</span>
          <select
            value={settings.palette}
            onchange={(e) => changePalette(e.currentTarget.value as PaletteId)}
          >
            {#each PALETTE_OPTIONS as opt (opt.id)}
              <option value={opt.id}>{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>
    {/if}

    {#if loadError}
      <div class="auth-banner" style="background: var(--color-deadline-accent); color: white;">
        <span>오류: {loadError}</span>
      </div>
    {/if}

    {#if !authConnected}
      <div class="auth-banner">
        <span>Google 계정 연결이 필요합니다</span>
        <button class="link" disabled={connecting} onclick={connectGoogle}>
          {connecting ? '연결 중…' : '연결하기'}
        </button>
      </div>
    {/if}

    <CardList
      {products}
      onAction={handleAction}
      onUndo={(id) => window.api.undoLast(id)}
      onEditHistory={(id, entryId, patch) => window.api.editHistoryEntry(id, entryId, patch)}
      onDeleteHistory={(id, entryId) => window.api.deleteHistoryEntry(id, entryId)}
    />
  </div>
</div>

<style>
  .app-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-surface-muted);
    border-radius: var(--radius-window);
    box-shadow: var(--shadow-window);
    border: 1px solid var(--color-border);
    /* 스크롤은 안쪽 .scroll-area가 담당하고, 여기서는 둥근 모서리 밖으로
       아무것도(스크롤바 포함) 튀어나가지 않도록 자르기만 한다. */
    overflow: hidden;
  }

  .scroll-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    /* 스크롤바가 생겼다 없어졌다 해도 카드 가로 폭이 바뀌지 않도록 자리를 항상 확보해둔다. */
    scrollbar-gutter: stable;
  }

  .titlebar {
    /* 스크롤 영역 밖(고정 플렉스 자식)에 둬서 스크롤 중에도 위치가 절대 변하지 않게 한다 —
       드래그 리전의 화면 좌표가 안정적이어야 창 이동이 항상 먹는다. */
    -webkit-app-region: drag;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 8px 10px 14px;
    flex-shrink: 0;
  }

  .app-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .controls {
    display: flex;
    gap: 2px;
    -webkit-app-region: no-drag;
  }

  .ctrl {
    background: none;
    border: none;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ctrl:hover {
    background: var(--color-surface);
  }

  .ctrl.active {
    background: var(--color-turn-mine-bg);
    color: var(--color-turn-mine-text);
  }

  .spin {
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .settings-panel {
    margin: 0 10px 8px;
    padding: 8px 10px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--color-text-secondary);
    gap: 10px;
  }

  .row select {
    font-family: inherit;
    font-size: 12px;
    color: var(--color-text-primary);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 3px 8px;
  }

  .auth-banner {
    margin: 0 10px 8px;
    padding: 8px 10px;
    background: var(--color-turn-mine-bg);
    color: var(--color-turn-mine-text);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    flex-shrink: 0;
  }

  .link {
    background: none;
    border: none;
    font-weight: 600;
    color: inherit;
    text-decoration: underline;
  }
</style>
