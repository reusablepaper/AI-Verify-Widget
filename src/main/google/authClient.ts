import { promises as fs } from 'node:fs'
import path from 'node:path'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

interface InstalledKey {
  client_id: string
  client_secret: string
}

interface SavedToken {
  client_id: string
  client_secret: string
  refresh_token: string
}

export class GoogleAuthClient {
  private readonly credentialsPath: string
  private readonly tokenPath: string

  constructor(credentialsPath: string, tokenPath: string) {
    this.credentialsPath = credentialsPath
    this.tokenPath = tokenPath
  }

  async hasToken(): Promise<boolean> {
    return fs
      .access(this.tokenPath)
      .then(() => true)
      .catch(() => false)
  }

  /** 최초 1회 동의 플로우 — 브라우저가 열리고, 완료되면 token.json을 저장한다. */
  async runFirstTimeConsent(): Promise<void> {
    // 주의: @google-cloud/local-auth는 googleapis(v187)가 기대하는 google-auth-library
    // 메이저 버전과 다른 버전을 내부 번들한다. 이 함수가 반환하는 client는 동의
    // 플로우 완료와 refresh_token 추출 용도로만 쓰고, 실제 API 호출에는 절대 쓰지
    // 않는다 — getApiClient()가 top-level google-auth-library로 새로 만든 클라이언트를 쓴다.
    console.log('[auth] credentialsPath =', this.credentialsPath)
    console.log('[auth] tokenPath =', this.tokenPath)
    const client = await authenticate({ scopes: SCOPES, keyfilePath: this.credentialsPath })
    console.log('[auth] consent flow finished, got refresh_token:', Boolean(client.credentials?.refresh_token))
    if (!client.credentials?.refresh_token) {
      throw new Error(
        'Google 인증에서 refresh_token을 받지 못했습니다. token.json을 지우고 동의 화면에서 다시 승인해주세요.'
      )
    }

    const keys = JSON.parse(await fs.readFile(this.credentialsPath, 'utf-8'))
    const key: InstalledKey = keys.installed ?? keys.web
    const payload: SavedToken = {
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    }

    await fs.mkdir(path.dirname(this.tokenPath), { recursive: true })
    await fs.writeFile(this.tokenPath, JSON.stringify(payload))
  }

  /** 평상시 API 호출용 클라이언트. 저장된 토큰이 없으면 예외를 던진다. */
  async getApiClient(): Promise<OAuth2Client> {
    const raw = await fs.readFile(this.tokenPath, 'utf-8')
    const token = JSON.parse(raw) as SavedToken

    const client = new google.auth.OAuth2(token.client_id, token.client_secret)
    client.setCredentials({ refresh_token: token.refresh_token })
    return client
  }

  /** 저장된 토큰이 없으면 동의 플로우를 실행한 뒤, API 호출용 클라이언트를 반환한다. */
  async authorize(): Promise<OAuth2Client> {
    if (!(await this.hasToken())) {
      await this.runFirstTimeConsent()
    }
    return this.getApiClient()
  }

  /** invalid_grant 등으로 토큰이 무효화된 경우 호출 — 재인증을 다시 하도록 만든다. */
  async forgetToken(): Promise<void> {
    await fs.rm(this.tokenPath, { force: true })
  }
}
