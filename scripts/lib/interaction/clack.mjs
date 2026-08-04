import { readFileSync, writeFileSync } from "node:fs"

const [payloadFile, resultFile] = process.argv.slice(2)
const guideRailColor = "\u001b[38;2;203;213;225m"
const guideRailPattern = /\u001b\[(?:36|90)m([│└]+)\u001b\[39m/g

function writeResult(result) {
  writeFileSync(resultFile, `${JSON.stringify(result)}\n`)
}

function assertPayload(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.kind !== "string") {
    throw new Error("无效的 Clack 交互请求")
  }
}

// Clack 未公开 guide 轨道的颜色配置；仅重着色侧边线，不影响其他状态符号。
function createGuideStyledOutput(output) {
  return new Proxy(output, {
    get(target, property) {
      if (property === "write") {
        return (chunk, ...args) => {
          const content = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk
          const styledContent = typeof content === "string"
            ? content.replace(guideRailPattern, `${guideRailColor}$1\u001b[39m`)
            : content
          return target.write(styledContent, ...args)
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

async function run() {
  const payload = JSON.parse(readFileSync(payloadFile, "utf8"))
  assertPayload(payload)

  const prompts = await import("@clack/prompts")
  const output = createGuideStyledOutput(process.stdout)
  let value

  switch (payload.kind) {
    case "select":
      value = await prompts.select({ message: payload.message, options: payload.options, output })
      break
    case "multiselect":
      value = await prompts.multiselect({
        message: payload.message,
        options: payload.options,
        required: true,
        output,
      })
      break
    case "groupMultiselect":
      value = await prompts.groupMultiselect({
        message: payload.message,
        options: payload.options,
        required: true,
        selectableGroups: true,
        output,
      })
      break
    case "input":
      value = await prompts.text({ message: payload.message, placeholder: payload.placeholder, output })
      break
    case "confirm":
      value = await prompts.confirm({ message: payload.message, output })
      break
    default:
      throw new Error(`未知的 Clack 交互类型：${payload.kind}`)
  }

  if (prompts.isCancel(value)) {
    writeResult({ status: "cancelled" })
    return
  }
  writeResult({ status: "ok", value })
}

run().catch((error) => {
  writeResult({
    status: "error",
    message: error instanceof Error ? error.message : String(error),
  })
})
