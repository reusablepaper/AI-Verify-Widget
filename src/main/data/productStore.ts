import { promises as fs } from 'node:fs'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import type { Product, ProductsFile } from './schema.ts'
import { CURRENT_SCHEMA_VERSION } from './schema.ts'

const BACKUP_COUNT = 3

function emptyFile(): ProductsFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, products: [] }
}

export class ProductStore {
  private filePath: string
  private data: ProductsFile | null = null

  constructor(dataDir: string, fileName = 'products.json') {
    this.filePath = path.join(dataDir, fileName)
  }

  private backupPath(n: number): string {
    return `${this.filePath}.bak${n}`
  }

  async load(): Promise<ProductsFile> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      this.data = JSON.parse(raw) as ProductsFile
      return this.data
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        this.data = emptyFile()
        return this.data
      }
      // 파싱 실패 등 — 최신 유효 백업으로 폴백
      for (let n = 1; n <= BACKUP_COUNT; n++) {
        try {
          const raw = await fs.readFile(this.backupPath(n), 'utf-8')
          const parsed = JSON.parse(raw) as ProductsFile
          console.warn(`products.json 로드 실패, 백업 ${n}에서 복구:`, err)
          this.data = parsed
          return this.data
        } catch {
          // 다음 백업 시도
        }
      }
      console.warn('products.json 및 모든 백업 로드 실패, 빈 상태로 시작:', err)
      this.data = emptyFile()
      return this.data
    }
  }

  getAll(): Product[] {
    if (!this.data) throw new Error('ProductStore.load()를 먼저 호출해야 합니다.')
    return this.data.products
  }

  async save(products: Product[]): Promise<void> {
    this.data = { schemaVersion: CURRENT_SCHEMA_VERSION, products }
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await this.rotateBackups()
    await writeFileAtomic(this.filePath, JSON.stringify(this.data, null, 2))
  }

  private async rotateBackups(): Promise<void> {
    const exists = await fs
      .access(this.filePath)
      .then(() => true)
      .catch(() => false)
    if (!exists) return

    for (let n = BACKUP_COUNT; n >= 1; n--) {
      const from = n === 1 ? this.filePath : this.backupPath(n - 1)
      const to = this.backupPath(n)
      try {
        await fs.copyFile(from, to)
      } catch {
        // 이전 단계 백업이 아직 없으면 무시
      }
    }
  }
}
