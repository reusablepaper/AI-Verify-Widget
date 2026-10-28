import cron from 'node-cron'

export interface DailyRefreshHandle {
  stop: () => void
}

/** 매일 12:30 (Asia/Seoul) 1회 자동 갱신. 놓친 갱신에 대한 캐치업 로직은 두지 않는다(사용자 결정). */
export function scheduleDailyRefresh(run: () => void | Promise<void>): DailyRefreshHandle {
  const task = cron.schedule(
    '30 12 * * *',
    () => {
      void run()
    },
    { timezone: 'Asia/Seoul' }
  )
  return { stop: () => task.stop() }
}
