import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import * as ts from "typescript"
import { createServer, resolveConfig } from "vite"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { syncWorkspaceSource, workspaceSource } from "../src/index.js"

import type { WorkspaceSourceConfig } from "../src/index.js"
import type { ViteDevServer } from "vite"

// Each fixture has two UI packages to detect accidental cross-UI declaration merging.
let root = ""

let server: ViteDevServer | undefined

/**
 * Write fixture content, creating its parent directories.
 * @param name - Path relative to the fixture workspace.
 * @param content - File contents.
 */
function write(name: string, content: string): void {
  const file = resolve(root, name)

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/** Read a generated project's effective path mappings. @param project - Fixture project directory. */
function readPaths(project = "example"): Record<string, string[]> {
  return JSON.parse(
    readFileSync(resolve(root, project, "tsconfig.workspace-source.json"), "utf8")
  ).compilerOptions.paths
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(resolve(tmpdir(), "workspace-source-")))
  write("package.json", JSON.stringify({ type: "module" }))

  const packages: Record<string, { root: string; entries: Record<string, string> }> = {}

  for (const name of ["core", "vue", "ui-a", "ui-b"]) {
    const packageName = `@fixture/${name}`

    const dependencies = name === "core" ? {} : { "@fixture/core": "workspace:*" }

    packages[packageName] = {
      root: name,
      entries: {
        ".": "src/index.ts",
        "./adapter": "src/adapter.ts",
        "./style.css": "src/style.css",
        "./*": "src/*",
      },
    }
    write(
      `${name}/package.json`,
      JSON.stringify({
        name: packageName,
        type: "module",
        dependencies,
        exports: {
          ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
          "./adapter": { types: "./dist/adapter.d.ts", default: "./dist/adapter.js" },
          "./style.css": "./dist/style.css",
        },
      })
    )
    write(
      `${name}/src/index.ts`,
      'export const origin = "source"; export interface ConfigDefinition {} export interface Config extends ConfigDefinition { value?: number }'
    )
    write(`${name}/src/adapter.ts`, 'export const adapter = "source"')
    write(`${name}/src/style.css`, ":root { color: red; }")
    write(`${name}/dist/index.js`, 'export const origin = "artifacts"')
    write(
      `${name}/dist/index.d.ts`,
      "export interface ConfigDefinition {} export interface Config extends ConfigDefinition { value?: number }"
    )
    write(`${name}/dist/adapter.js`, 'export const adapter = "artifacts"')
    write(`${name}/dist/adapter.d.ts`, "export declare const adapter: string")
    write(`${name}/dist/style.css`, ":root { color: blue; }")
    mkdirSync(resolve(root, "node_modules/@fixture"), { recursive: true })
    symlinkSync(resolve(root, name), resolve(root, "node_modules", packageName), "dir")
  }

  write(
    "vue/src/index.ts",
    `import type { Config } from '@fixture/core';
declare module '@fixture/core' { interface ConfigDefinition { sourceOnly?: boolean } }
export type { Config };`
  )
  write("vue/dist/index.d.ts", "export type { Config } from '@fixture/core'")
  write(
    "ui-a/package.json",
    JSON.stringify({
      name: "@fixture/ui-a",
      dependencies: { "@fixture/vue": "workspace:*" },
    })
  )
  write(
    "example/package.json",
    JSON.stringify({
      name: "example",
      type: "module",
      dependencies: { "@fixture/ui-a": "1.0.0" },
    })
  )
  write("example/.env", "VITE_USE_SOURCE=true\n")
  write("ui-a/.env", "VITE_USE_SOURCE=true\n")
  write(
    "example/consumer.ts",
    "import '@fixture/vue'; import type { Config } from '@fixture/core'; const config: Config = { sourceOnly: true }; export { config }"
  )
  write("example/runtime.ts", "export { origin } from '@fixture/core'")
  write(
    "example/tsconfig.json",
    JSON.stringify({
      extends: "./tsconfig.workspace-source.json",
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ESNext",
        strict: true,
        noEmit: true,
        types: [],
      },
      files: ["consumer.ts"],
    })
  )

  const config: WorkspaceSourceConfig = {
    packages,
    projects: [
      { root: "example", kind: "application" },
      { root: "ui-a", kind: "library" },
    ],
  }

  write("workspace-source.config.ts", `export default ${JSON.stringify(config)}`)
})

afterEach(async () => {
  await server?.close()
  server = undefined
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

describe("workspace source synchronization", () => {
  it("selects only the dependency closure, resolves subpaths, and avoids rewriting unchanged files", async () => {
    const first = await syncWorkspaceSource({ projectRoot: resolve(root, "example") })

    const timestamp = statSync(first.filePath).mtimeMs

    expect(first.enabled).toBe(true)
    expect(readPaths()["@fixture/vue"]).toEqual(["../vue/src/index.ts"])
    expect(readPaths()["@fixture/core/adapter"]).toEqual(["../core/src/adapter.ts"])
    expect(readPaths()["@fixture/core/style.css"]).toEqual(["../core/src/style.css"])
    expect(readPaths()["@fixture/core/*"]).toEqual(["../core/src/*"])
    expect(readPaths()).not.toHaveProperty("@fixture/ui-b")
    expect(
      (await syncWorkspaceSource({ projectRoot: resolve(root, "example") })).changed
    ).toBe(false)
    expect(statSync(first.filePath).mtimeMs).toBe(timestamp)
  })

  it("honors mode, local files, process overrides, and missing switches", async () => {
    write("example/.env.production", "VITE_USE_SOURCE=false\n")
    expect(
      (
        await syncWorkspaceSource({
          projectRoot: resolve(root, "example"),
          mode: "production",
        })
      ).enabled
    ).toBe(false)
    expect(readPaths()).not.toHaveProperty("@fixture/core")

    write("example/.env.production.local", "VITE_USE_SOURCE=true\n")
    expect(
      (
        await syncWorkspaceSource({
          projectRoot: resolve(root, "example"),
          mode: "production",
        })
      ).enabled
    ).toBe(true)
    vi.stubEnv("VITE_USE_SOURCE", "false")
    expect(
      (await syncWorkspaceSource({ projectRoot: resolve(root, "example") })).enabled
    ).toBe(false)
    vi.unstubAllEnvs()
    write("example/.env", "")
    expect(
      (await syncWorkspaceSource({ projectRoot: resolve(root, "example") })).enabled
    ).toBe(false)
  })

  it("makes new source declarations visible to TypeScript without building dependencies", async () => {
    const diagnostics = (): readonly ts.Diagnostic[] => {
      const file = resolve(root, "example/tsconfig.json")

      const config = ts.readConfigFile(file, (name) => ts.sys.readFile(name))

      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(file))

      return ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames, parsed.options))
    }

    await syncWorkspaceSource({ projectRoot: resolve(root, "example") })
    expect(diagnostics()).toEqual([])
    write("example/.env", "VITE_USE_SOURCE=false\n")
    await syncWorkspaceSource({ projectRoot: resolve(root, "example") })
    expect(diagnostics().some((item) => item.code === 2353)).toBe(true)
  })

  it("initializes one or all projects through the packaged CLI", () => {
    const cli = fileURLToPath(new URL("../bin/workspace-source.mjs", import.meta.url))

    execFileSync(process.execPath, [cli, "sync", "--project", "example"], { cwd: root })
    expect(readPaths()).toHaveProperty("@fixture/vue")
    execFileSync(process.execPath, [cli, "sync", "--all"], { cwd: root })
    expect(readPaths("ui-a")).toHaveProperty("@fixture/vue")
    expect(() =>
      execFileSync(process.execPath, [cli, "sync", "--all", "--project", "."], {
        cwd: root,
        stdio: "pipe",
      })
    ).toThrow()
  })
})

describe("Vite source resolution", () => {
  it("resolves root, adapter, and style entries and reloads TypeScript paths when env changes", async () => {
    const projectRoot = resolve(root, "example")

    server = await createServer({
      root: projectRoot,
      configFile: false,
      logLevel: "silent",
      plugins: [workspaceSource({ projectRoot })],
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, fs: { allow: [root] } },
    })
    for (const [specifier, target] of [
      ["@fixture/core", "core/src/index.ts"],
      ["@fixture/core/adapter", "core/src/adapter.ts"],
      ["@fixture/core/style.css", "core/src/style.css"],
    ]) {
      expect(
        (
          await server.pluginContainer.resolveId(
            specifier,
            resolve(projectRoot, "runtime.ts")
          )
        )?.id
      ).toBe(resolve(root, target))
    }

    await vi.waitFor(() =>
      expect(server?.watcher.getWatched()[projectRoot]).toContain(".env")
    )
    write("example/.env", "VITE_USE_SOURCE=false\n")
    await vi.waitFor(() => expect(readPaths()).not.toHaveProperty("@fixture/core"), {
      timeout: 5000,
    })
    expect(
      (
        await server.pluginContainer.resolveId(
          "@fixture/core",
          resolve(projectRoot, "runtime.ts")
        )
      )?.id
    ).toBe(resolve(root, "core/dist/index.js"))
  })

  it("keeps library builds on artifacts without modifying the development config", async () => {
    const projectRoot = resolve(root, "ui-a")

    const synchronized = await syncWorkspaceSource({ projectRoot })

    const content = readFileSync(synchronized.filePath, "utf8")

    const timestamp = statSync(synchronized.filePath).mtimeMs

    // A different build mode must not switch the editor back to artifact paths.
    write("ui-a/.env.production", "VITE_USE_SOURCE=false\n")

    const config = await resolveConfig(
      {
        root: projectRoot,
        configFile: false,
        plugins: [workspaceSource({ projectRoot })],
        logLevel: "silent",
      },
      "build"
    )

    expect(
      config.resolve.alias.some(
        (entry) => entry.find instanceof RegExp && entry.find.test("@fixture/core")
      )
    ).toBe(false)
    expect(readFileSync(synchronized.filePath, "utf8")).toBe(content)
    expect(statSync(synchronized.filePath).mtimeMs).toBe(timestamp)

    const application = await resolveConfig(
      {
        root: resolve(root, "example"),
        configFile: false,
        plugins: [workspaceSource({ projectRoot: resolve(root, "example") })],
        logLevel: "silent",
      },
      "build"
    )

    expect(
      application.resolve.alias.some(
        (entry) => entry.find instanceof RegExp && entry.find.test("@fixture/core")
      )
    ).toBe(true)
  })
})
