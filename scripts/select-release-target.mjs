#!/usr/bin/env node

import readline from "node:readline"

const args = process.argv.slice(2)
const channelOptionIndex = args.indexOf("--channel")
const channel =
  channelOptionIndex === -1 ? "latest" : args.splice(channelOptionIndex, 2)[1] || "latest"
const targets = args

const channelLabels = {
  latest: "正式版发布",
  dev: "Dev 开发测试发布",
  alpha: "Alpha 预发布",
  beta: "Beta 预发布",
  rc: "RC 候选发布",
  next: "Next 预发布",
}

const channelDescriptions = {
  latest: `发布到 npm latest，仅允许 main 分支。`,
  dev: `发布到 npm dev tag，用于日常开发测试，不保证稳定。`,
  alpha: `发布到 npm alpha tag，用于早期实验和开发分支临时验证。`,
  beta: `发布到 npm beta tag，用于公开测试。`,
  rc: `发布到 npm rc tag，用于正式版前的候选验证。`,
  next: `发布到 npm next tag，用于下一版本预览。`,
}

/**
 * 真实错误必须使用非 0 退出码，让 release.sh/pnpm 明确中断。
 */
function fail(message) {
  process.stderr.write(` 错误：${message}\n`)
  process.exit(1)
}

/**
 * 用户主动取消不是发布失败；通过哨兵值通知 release.sh 停止后续流程。
 */
function cancel() {
  // pnpm 会把非 0 退出码包装成 ELIFECYCLE；取消选择应停止发布但不算脚本失败。
  process.stderr.write("\n  已取消发布目标选择\n")
  process.stdout.write("__SCHEMX_RELEASE_CANCELLED__\n")
  process.exit(0)
}

/**
 * 环境变量和命令行参数都复用这层校验，避免自动化绕过目标列表。
 */
function validateTarget(target) {
  if (!targets.includes(target)) {
    fail(`未知发布目标：${target}，可选值为 ${targets.join("、")}`)
  }
}

if (targets.length === 0) {
  fail("缺少发布目标列表")
}

if (!channelLabels[channel]) {
  fail(`未知发布模式：${channel}，可选值为 ${Object.keys(channelLabels).join("、")}`)
}

const envTarget = process.env.SCHEMX_RELEASE_TARGET
if (envTarget) {
  // 自动化场景不应依赖 TTY 交互，CI/测试可通过环境变量指定目标。
  validateTarget(envTarget)
  process.stdout.write(`${envTarget}\n`)
  process.exit(0)
}

// release.sh 通过命令替换读取 stdout，所以交互界面必须写到 stderr。
const screen = process.stderr
const styles = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  darkGray: "\x1b[90m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

if (!process.stdin.isTTY || !screen.isTTY) {
  fail("当前终端不支持交互选择。请传入发布目标参数，或设置 SCHEMX_RELEASE_TARGET。")
}

let selectedIndex = 0

/**
 * 每次按键后重绘整个选择区域，避免旧高亮残留在终端里。
 */
function render() {
  readline.cursorTo(screen, 0, 0)
  readline.clearScreenDown(screen)
  screen.write(`  ${styles.bold}请选择发布目标${styles.reset}\n`)
  screen.write(
    `  ${styles.cyan}发布模式：${channelLabels[channel]} (${channel})${styles.reset}\n`
  )
  screen.write(`  ${styles.dim}${channelDescriptions[channel]}${styles.reset}\n`)
  screen.write(`  ${styles.dim}使用方向键移动，Enter 确认，Esc 取消。${styles.reset}\n\n`)

  targets.forEach((target, index) => {
    if (index === selectedIndex) {
      screen.write(`${styles.bold}${styles.blue}› ${target.padEnd(10)} ${styles.reset}\n`)
      return
    }

    screen.write(`${styles.darkGray}  ${target}${styles.reset}\n`)
  })
}

/**
 * 选中后必须释放 stdin 并退出，否则 stdin.resume() 会让 Node 进程保持运行，
 * release.sh 的命令替换就会一直等待，后续发布命令不会执行。
 */
function finish(target) {
  process.stdin.setRawMode(false)
  process.stdin.off("keypress", handleKeypress)
  process.stdin.pause()
  readline.cursorTo(screen, 0)
  readline.clearScreenDown(screen)
  screen.write(
    `\n  ${styles.cyan}发布模式：${channelLabels[channel]} (${channel})${styles.reset}\n`
  )
  screen.write(`  ${styles.cyan}发布目标：${target}${styles.reset}\n`)
  // stdout 只输出机器可读的目标名称，供 release.sh 捕获。
  process.stdout.write(`${target}\n`)
  process.exit(0)
}

/**
 * raw mode 下只处理方向键、确认和取消；其他按键保持无动作，避免误触发布。
 */
function handleKeypress(_, key) {
  if (key.name === "up") {
    selectedIndex = (selectedIndex - 1 + targets.length) % targets.length
    render()
    return
  }

  if (key.name === "down") {
    selectedIndex = (selectedIndex + 1) % targets.length
    render()
    return
  }

  if (key.name === "return" || key.name === "enter") {
    finish(targets[selectedIndex])
    return
  }

  if (key.name === "escape" || (key.ctrl && key.name === "c")) {
    process.stdin.setRawMode(false)
    process.stdin.off("keypress", handleKeypress)
    readline.cursorTo(screen, 0)
    readline.clearScreenDown(screen)
    cancel()
  }
}

readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.on("keypress", handleKeypress)
render()
