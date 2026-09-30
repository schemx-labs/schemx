/**
 * 发布期间的 package.json 版本备份。
 *
 * @remarks 原实现用 `trap` 记录一个备份目录，并在两个调用点读取「已发布包列表」来决定
 * 回滚范围；当状态文件损坏导致该列表读取失败时，退出码被吞掉，列表退化为空，
 * 结果是回滚全部已发布包的版本。现在把「能否安全回滚」变成显式判断：
 * 状态不可信时保留备份并中止，由使用者决定，而不是猜测。
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { type Catalog } from "../core/catalog.ts"

import { type PlanPackage } from "./plan.ts"

/** 备份中的一个包条目。 */
interface BackupEntry {
  /** 逻辑包名。 */
  readonly target: string
  /** package.json 绝对路径。 */
  readonly manifestPath: string
}

/** 一次发布过程中的版本备份。 */
export class VersionBackup {
  readonly #entries: readonly BackupEntry[]
  #directory: string | undefined

  /**
   * @param entries - 需要备份的包。
   * @param directory - 备份目录。
   */
  private constructor(entries: readonly BackupEntry[], directory: string) {
    this.#entries = entries
    this.#directory = directory
  }

  /**
   * 为冻结计划中会被改写版本的包创建备份。
   *
   * @param catalog - 目录索引。
   * @param packages - 冻结计划中的发布包。
   * @returns 版本备份。
   * @throws {Error} 备份写入失败时抛出。
   */
  static create(catalog: Catalog, packages: readonly PlanPackage[]): VersionBackup {
    const directory = mkdtempSync(path.join(tmpdir(), "schemx-release-versions-"))

    const publishable = catalog.publishable()

    const entries = packages.flatMap((item): BackupEntry[] => {
      const target = catalog.find(item.package, publishable)

      return target
        ? [{ target: target.directory, manifestPath: target.manifestPath }]
        : []
    })

    for (const entry of entries) {
      copyFileSync(entry.manifestPath, path.join(directory, `${entry.target}.json`))
    }

    return new VersionBackup(entries, directory)
  }

  /** 备份目录路径。 */
  get directory(): string {
    return this.#directory ?? ""
  }

  /** 备份是否仍然有效。 */
  get active(): boolean {
    return this.#directory !== undefined && existsSync(this.#directory)
  }

  /**
   * 回滚指定包之外的全部包版本。
   *
   * @param keep - 需要保留版本改动的逻辑包名集合。
   * @returns 被回滚的逻辑包名列表。
   */
  restoreExcept(keep: ReadonlySet<string>): readonly string[] {
    const restored: string[] = []

    for (const entry of this.#entries) {
      if (keep.has(entry.target)) {
        continue
      }

      this.#restoreOne(entry)
      restored.push(entry.target)
    }

    return restored
  }

  /**
   * 回滚全部包版本。
   *
   * @returns 被回滚的逻辑包名列表。
   */
  restoreAll(): readonly string[] {
    return this.restoreExcept(new Set())
  }

  /**
   * 删除备份目录；目录不存在时保持幂等。
   */
  discard(): void {
    if (this.#directory !== undefined) {
      rmSync(this.#directory, { recursive: true, force: true })
      this.#directory = undefined
    }
  }

  /**
   * 还原单个包的 package.json。
   *
   * @param entry - 包条目。
   */
  #restoreOne(entry: BackupEntry): void {
    const source = path.join(this.#directory ?? "", `${entry.target}.json`)

    if (existsSync(source)) {
      copyFileSync(source, entry.manifestPath)
    }
  }
}
