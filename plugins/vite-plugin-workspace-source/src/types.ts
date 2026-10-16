/**
 * A workspace package and its source entry points, relative to the package directory.
 */
export interface WorkspaceSourcePackage {
  /**
   * Package directory relative to the workspace configuration.
   */
  readonly root: string
  /**
   * Export keys such as '.', './adapter', './style.css', or './*'.
   */
  readonly entries: Readonly<Record<string, string>>
}

/**
 * A project whose dependency resolution can switch between source and artifacts.
 */
export interface WorkspaceSourceProject {
  /**
   * Project directory relative to the workspace configuration.
   */
  readonly root: string
  /**
   * Library builds always consume dependency artifacts.
   */
  readonly kind: "library" | "application"
}

/**
 * Shared registration consumed by Vite and the TypeScript synchronizer.
 */
export interface WorkspaceSourceConfig {
  /**
   * Package names mapped to their source entry points.
   */
  readonly packages: Readonly<Record<string, WorkspaceSourcePackage>>
  /**
   * Projects with their own environment files and generated TypeScript paths.
   */
  readonly projects: readonly WorkspaceSourceProject[]
}

/**
 * Options for the Vite plugin and standalone synchronizer.
 */
export interface WorkspaceSourceOptions {
  /**
   * Absolute project directory, normally the Vite configuration's directory.
   */
  readonly projectRoot: string
  /**
   * Environment mode; standalone synchronization defaults to development.
   */
  readonly mode?: string
}

/**
 * Result of synchronizing one project's generated paths.
 */
export interface WorkspaceSourceSyncResult {
  /**
   * Project whose configuration was synchronized.
   */
  readonly projectRoot: string
  /**
   * Generated configuration file.
   */
  readonly filePath: string
  /**
   * Whether dependency source entries are enabled.
   */
  readonly enabled: boolean
  /**
   * Whether the file contents actually changed.
   */
  readonly changed: boolean
}
