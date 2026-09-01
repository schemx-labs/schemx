<p align="center">
  <img src="./logo.png" alt="schemx logo" width="360" />
</p>

<p align="center">
  A schema-driven dynamic form engine that centralizes field state, validation, dependencies, and dynamic structure while decoupling form business rules from concrete UI components.
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

<p align="center">
  <a href="#packages">Packages</a> · <a href="#quick-start">Quick Start</a> · <a href="#examples">Examples</a> · <a href="#local-development">Local Development</a> · <a href="#release-scripts">Release Scripts</a> · <a href="#generate-release-notes-by-package">Release Notes by Package</a>
</p>

schemx focuses on the parts of dynamic forms that are most likely to become difficult to manage: field state, validation, dependencies, runtime Schema updates, renderable view projections, and UI integration boundaries. Business code only describes the Schema; Core compiles it into a stable runtime structure, and upper-layer adapters render the ViewSchemas into concrete interfaces.

## Packages

| Package                                      | Responsibility                  | Use Case                                             |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| [`@schemx/core`](./packages/core)           | Framework-agnostic headless form engine | Build form runtimes, field dependencies, validation, and ViewSchemas |
| [`@schemx/validator`](./packages/validator) | Third-party validator adapter   | Integrate async-validator and other non-Standard Schema validators |
| [`@schemx/vue`](./packages/vue)             | Vue 3 adapter                  | Render ViewSchemas as Vue component trees            |
| [`@schemx/vant`](./packages/vant)           | Vant renderer adapter           | Quickly build mobile dynamic forms with Vant 4     |

## Quick Start

Install dependencies according to the level of functionality your project needs:

```bash
# Use only the framework-agnostic form runtime
pnpm add @schemx/core

# Run the Zod Standard Schema example below
pnpm add @schemx/core zod

# Integrate async-validator with Core
pnpm add @schemx/core @schemx/validator async-validator

# Add a custom Vue Renderer
pnpm add @schemx/vue @schemx/core vue

# Use the built-in Vant Renderer
pnpm add @schemx/vant @schemx/vue @schemx/core vant vue
```

See the documentation for each package for complete examples, style import instructions, and API details:

- [`@schemx/core` guide](./packages/core/README.md)
- [`@schemx/validator` guide](./packages/validator/README.md)
- [`@schemx/vue` guide](./packages/vue/README.md)
- [`@schemx/vant` guide](./packages/vant/README.md)

Core validation uses the `required` field, a named rule Registry, and a flat result discriminated by the `valid` field:

```ts
import { createForm, createPresetRuleRegistry } from "@schemx/core"
import { z } from "zod"

const registry = createPresetRuleRegistry()
registry.register("email", z.string().email("Invalid email format"))

const form = createForm<{ email: string }>({
  initialValues: { email: "" },
  schemas: [
    {
      name: "email",
      label: "Email",
      componentType: "input",
      required: { message: "Please enter your email" },
      rules: ["email"],
    },
  ],
  presetRuleRegistry: registry,
})

const result = await form.validate()
if (!result.valid) console.log(result.errors)
```

## Architecture Boundaries

```text
raw schemas
  -> @schemx/core
  -> runtime Schema Node
  -> validation / dependency / scheduler
  -> ViewSchemas
  -> @schemx/vue
  -> renderer registry
  -> @schemx/vant or business renderer
```

`@schemx/core` does not depend on a specific UI framework or render the DOM. It maintains form rules, field state, and runtime Schema, then outputs ViewSchemas for the UI layer to consume.

`@schemx/core/adapter` is the public integration boundary for UI adapters. Use `createFormStateAdapter(form)` to consume stable snapshots and subscriptions for form values, touched fields, pending fields, loading, and individual field state; use `createRendererRegistry()` to register renderers.

`@schemx/vue` only adapts the form to a Vue component tree and does not bind to a specific component library. Business code can use `rendererRegistry` to connect its own inputs, selectors, upload components, or design-system components.

`@schemx/vant` is a collection of Vant 4 renderers for mobile form scenarios. It reuses the capabilities of `@schemx/core` and `@schemx/vue`, and automatically registers the default renderers at the package entry point.

`@schemx/vue` and `@schemx/vant` declare downstream capabilities as `peerDependencies`. Business projects must install the corresponding dependencies explicitly, avoiding implicit installation of core runtime versions by the published packages.

## When to Use

- Form fields come from backend configuration, low-code configuration, or business Schemas.
- Field visibility, disabled, readonly, required, or validation rules need to change dynamically based on other fields.
- The form structure changes at runtime, such as conditional fields, multi-step questionnaires, or remote Schemas.
- The same form capabilities need to be reused across multiple UI component libraries or application targets.
- Form runtime capabilities need to be decoupled from UI component implementations.

If you only have a few static fields and do not need field dependencies, dynamic Schemas, or cross-platform reuse, using the form capabilities built into your UI component library is usually simpler.

## Choosing an Entry Point

- Need only form runtime, validation, dependencies, and ViewSchemas: use `@schemx/core`.
- Already have a Vue component library or business components and need to register your own renderers: install `@schemx/vue`, `@schemx/core`, and `vue`.
- Using Vue 3 + Vant 4 and want built-in mobile renderers: install `@schemx/vant`, `@schemx/vue`, `@schemx/core`, `vant`, and `vue`.

See the documentation for each package for detailed APIs and usage examples.

## Container State and Dynamic Subtrees

Group and Dependency can both act as containers with `visible`, `readonly`, `disabled`, and `dependencies`. Group declares `children`, while Dependency declares `to` and `renderer`; containers do not use `componentType`. Container state propagates recursively to all descendant fields: descendants are invisible when an ancestor is hidden, and descendants cannot override an ancestor's readonly or disabled state through their own configuration.

```ts
const schemas = [
  { name: "editable", label: "Editable", componentType: "switch" },
  {
    key: "profile",
    label: "Profile",
    collapsible: true,
    destroyOnCollapse: false,
    dependencies: {
      triggerFields: ["editable"],
      readonly: (values) => !values.editable,
    },
    children: [{ name: "name", label: "Name", componentType: "input" }],
  },
]
```

Dependency's `to` only rebuilds the dynamic subtree; container `dependencies.triggerFields` only updates presentation state. They can observe the same field, but must be declared separately. Container dependencies support only `visible`, `readonly`, and `disabled`; side-effect-based `trigger` is not supported.

You can interact with Group and Dependency container state in the [Vant example project](./examples/vant).

## Examples

- [Vant Example](./examples/vant/README.md): covers built-in Renderers, validation, dependencies, dynamic Schemas, container state, and slots.
- [uni-app + Vant Example](./examples/uniapp-vant): validates integration across H5 and multiple mini-program build targets.

## Local Development

The repository uses a pnpm workspace. Install dependencies first, then use the root command to interactively choose a package, plugin, or example to run or build:

```bash
pnpm install
pnpm dev
```

You can also bypass interactive selection and run a specific workspace directly:

```bash
pnpm --filter vant-demo dev
```

| Command               | Description                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev`            | Interactively select and start one target with a `dev` or `dev:h5` script; non-interactive environments must specify exactly one target. |
| `pnpm build`          | Interactively select targets to build; non-interactive environments build all targets by default. |
| `pnpm build:analyze`  | Interactively select and run the build analysis script.                                     |
| `pnpm test`           | Interactively select and run tests; non-interactive environments run all tests by default.   |
| `pnpm type-check`     | Interactively select and run TypeScript type checking.                                       |
| `pnpm lint`           | Interactively select and run ESLint checks.                                                   |
| `pnpm lint:fix`       | Interactively select and run automatic ESLint fixes.                                         |
| `pnpm format`         | Interactively select and run Prettier formatting.                                            |
| `pnpm format:check`   | Interactively select and run Prettier format checks.                                         |
| `pnpm check`          | Interactively select and run the target's complete static checks.                            |
| `pnpm pack-local`     | Interactively select packable `packages` / `plugins` targets and generate tarballs.          |
| `pnpm check:packages` | Check workspace package configuration and build output external boundaries.                  |
| `pnpm preview`        | Start Vite Preview.                                                                          |

## Project Workflow

Development, build, quality, and test commands at the repository root are all executed through `scripts/workflow.sh`. In a local terminal, Clack selects `packages`, `plugins`, and `examples` targets that define the relevant script for the task; `dev` uses single selection, while other batch tasks use multiple selection. In CI or pipeline environments, batch tasks run all matching targets by default, while `dev` must specify exactly one target. Each target directly executes its corresponding package script.

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm check:packages
```

Finite batch operations stop at the first failure by default. Build tasks, workspace quality tasks, and `release check`, `release pack`, and `release verify` accept `--keep-going` to continue with the remaining targets and return the first failure code at the end. Cancellation always stops immediately:

```bash
bash scripts/workflow.sh lint all --keep-going
bash scripts/workflow.sh release pack all --keep-going
bash scripts/workflow.sh release verify /path/to/plan.json --keep-going
```

`pnpm pack-local` also uses the same workflow to select multiple targets; it only handles locally packable `packages` and `plugins` targets. In CI, you can pass `all`, `packages/core`, or `plugins/<name>` after the command, or use `SCHEMX_WORKFLOW_TARGETS` to provide a comma-separated target list.

All workflows share the same Shell UI: a command allows only one top-level flow, while tasks own the command, duration, and exit code. `ui_group_begin` / `ui_group_end` support nestable business groups without rendering duplicate stage feedback. The UI writes to stderr; selection and input results are written to stdout, and confirmation is represented by the exit code (confirmed `0`, rejected `1`, cancelled `130`). `--log live` passes through native stdout/stderr unchanged, while `--log capture` buffers output before rendering it. Use `SCHEMX_UI_FORMAT=plain` to force stable plain text, or set `SCHEMX_UI_EVENTS_FILE=/path/to/events.jsonl` to append machine-consumable `schemx.ui/v2` JSONL lifecycle events. Adjacent UI output blocks retain one guide-rail spacer line prefixed with `│`; task completion status and the end of raw logs retain one or two guide-rail spacer lines. Non-interactive confirmation can be enabled with `SCHEMX_UI_ASSUME_YES=true`.

Release is an independent command domain that uses the `release:*` prefix.

## Release Scripts

Release scripts are all run through `pnpm release:*`. Commands involving package targets support `all`, `core`, `vue`, and `vant`:

- When `release:publish` receives no arguments, it sequentially selects the release channel, release target, and version baseline action; release targets support space-separated multi-selection.
- `release:pack` targets `all` by default.
- Explicit arguments are recommended in CI or non-interactive environments.

Stable releases use the `latest` channel. When `patch`, `minor`, `major`, or `x.y.z` is selected, the script automatically bumps the version, synchronizes `pnpm-lock.yaml`, commits the version changes, and continues publishing:

Version actions follow SemVer's `x.y.z` format:

- `patch`: increment `z`, for example `1.2.3` -> `1.2.4`
- `minor`: increment `y`, for example `1.2.3` -> `1.3.0`
- `major`: increment `x`, for example `1.2.3` -> `2.0.0`

```bash
pnpm release:publish latest vue patch
pnpm release:publish latest vue x.y.z
```

To publish the currently committed version, choose `current`:

```bash
pnpm release:publish latest vue current
```

An exact version (replace `x.y.z` in the example with the target version) is allowed only for a single-package target and must not have been published yet. Use `current` for an already published version to avoid forcing packages from different version lines to share the same version.

Prereleases require an explicit `patch`, `minor`, `major`, or `x.y.z` version baseline. `alpha`, `beta`, `rc`, and `next` generate sortable versions such as `0.1.0-beta.0`; the local `package.json` is restored after publishing:

```bash
# Publishes the first public Beta for 1.0.0; subsequent releases increment to 1.0.0-beta.1 automatically.
pnpm release:publish beta vue 1.0.0
```

### Custom GitHub Release Notes

A stable `latest` release creates a GitHub Release for each package. By default, the notes are generated from Conventional Commits between the package's previous tag and `HEAD`. When manual confirmation is needed, place `release-notes.md` in the corresponding package root, or generate a summary with an Agent. Both methods affect only GitHub Release notes, not the version commit message.

```bash
# Use a package-level Markdown file, such as packages/core/release-notes.md.
pnpm release:publish latest core current

# Call an executable generator; the generator outputs Markdown to stdout.
SCHEMX_RELEASE_NOTES_GENERATOR=/path/to/release-notes-generator \
  pnpm release:publish latest core current
```

The generator receives the following arguments: `--repository`, `--package`, `--version`, `--tag`, `--previous-tag`, and `--commit-range`. It can use these to call an Agent/LLM and obtain package-level changes with `git diff <commit-range> -- packages/<package>`. A Skill cannot be executed directly by Bash; the generator should be implemented by an Agent CLI or automation service with the corresponding Skill.

If `SCHEMX_RELEASE_NOTES_FILE` is set, it overrides the package-level default path and is intended only for temporary single-package releases. For multi-package releases, each package reads its own `packages/<package>/release-notes.md`; if the file does not exist, notes are generated from that package's own previous tag.

### Generate Release Notes by Package

The repository maintains release notes through a structured data → validation → rendering workflow. The Agent's `release-notes-generator` Skill analyzes Git Diff, public APIs, TypeScript types, and user impact; repository scripts handle only repeatable fact collection, data validation, and Markdown rendering.

#### Daily Usage

Normally, you do not need to run `release:notes:*` commands or create JSON manually. Simply describe the release intent to an Agent with the `release-notes-generator` Skill.

Preview release notes for all currently affected packages:

```text
Use release-notes-generator to analyze the current HEAD and preview Release Notes for all affected packages.
```

Previewing does not write to files. The Agent automatically collects each package's Tags, Diff, public API, types, and dependency impact, determines which packages have user-visible changes, and displays each package's summary, Breaking Changes, and Markdown preview.

After reviewing the content, explicitly request that it be written:

```text
Confirm writing Release Notes for all affected packages and generate version archives.
```

The Skill automatically performs the following operations:

1. Collects Git evidence for each affected release package;
2. Generates and reviews independent Release Data for each package;
3. Validates evidence, classification, and Breaking Change migration notes;
4. Updates `packages/<package>/release-notes.md` for each package;
5. Generates the version archive at `docs/releases/<package>/<version>.md`.

The existing `pnpm release:publish` command reads package-level `release-notes.md` files directly when creating GitHub Releases, so you can continue with the existing release workflow after generating the notes.

The Skill includes deterministic scripts, release policies, data Schemas, and Markdown templates for evidence collection, data validation, and Markdown rendering. These are not part of the repository's daily commands; normal releases only require invoking the Skill.

### Common Commands

| Command                                                       | Description                                                                                                                     | Usage                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm release:check`                                          | Run all pre-release checks: install consistency, tests, lint, build, and published-package content checks.                      | Local pre-release check: `pnpm release:check`                                                                                        |
| `pnpm release:pack [target]`                                  | Generate local tarballs to inspect the actual published-package contents.                                                      | All packages: `pnpm release:pack`; single package: `pnpm release:pack vant`                                                         |
| `pnpm release:publish [channel] [target] [version-action]`    | Publish to a specified channel. All channels support `patch`, `minor`, `major`, or `x.y.z`; `current` is limited to `latest`. Targets can be `all` or `core,vue`. | Interactive: `pnpm release:publish`; stable: `pnpm release:publish latest vue patch`; public Beta: `pnpm release:publish beta core 1.0.0` |
| `pnpm release:dry-run <channel> <target> <version-action>`    | Calculate and display a frozen release plan without running quality checks, writing versions, publishing to npm, creating Git Tags, or creating GitHub Releases. | `pnpm release:dry-run beta core 1.0.0` |
| `pnpm release:test`                                           | Run tests for the release scripts without publishing or changing versions.                                                     | Run after modifying release scripts: `pnpm release:test`                                                                             |

### Release Channels

| Type     | Purpose                         |
| -------- | ------------------------------- |
| `latest` | Stable release                  |
| `dev`    | Daily development testing; unstable |
| `alpha`  | Internal preview; the API may change |
| `beta`   | External testing; functionality is mostly complete |
| `rc`     | Release candidate               |
| `next`   | Preview of the next version     |
