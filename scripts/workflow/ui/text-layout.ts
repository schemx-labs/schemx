// Unicode 可见列宽与 ANSI 文本换行，不持有终端或主题状态。
/**
 * SGR 颜色序列。用字符码构造，避免正则中出现裸控制字符。
 */
const ANSI_SGR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

/**
 * 将颜色序列与可见文字分开，换行时不会切断转义序列。
 */
const ANSI_PARTS = new RegExp(`(${ANSI_SGR.source})`)

/**
 * 按字素计算宽度，避免切开组合字符。
 */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/**
 * 汉字、全角字符和默认以图形呈现的 emoji 占两个终端列。
 */
const WIDE_CHARACTER =
  /[\u1100-\u115f\u2329\u232a\u2e80-\u303e\u3040-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u

/**
 * 计算文本的可见宽度，忽略 ANSI 颜色序列。
 *
 * @param text - 文本。
 * @returns 占用的终端列数。
 * @example visibleWidth("发布 beta") // 9
 */
export function visibleWidth(text: string): number {
  // 只累计可见字素占用的终端列，颜色序列不计入宽度。
  let width = 0

  // 删除颜色后按字素遍历，组合标记不单独占列。
  for (const { segment } of GRAPHEMES.segment(text.replace(ANSI_SGR, ""))) {
    width += WIDE_CHARACTER.test(segment) ? 2 : 1
  }

  return width
}

/**
 * 按终端列宽换行，保留显式换行、组合字符与 ANSI 颜色。
 *
 * @param text - 待换行文本。
 * @param width - 每行最多占用的终端列数。
 * @returns 换行后的文本行。
 * @example wrapText("发布前检查", 6) // ["发布前", "检查"]
 */
export function wrapText(text: string, width: number): readonly string[] {
  // 保留所有物理行，包括显式换行产生的空行。
  const lines: string[] = []

  // 每个显式段落独立换行，段落间空行不会被折叠。
  for (const paragraph of text.split("\n")) {
    // 当前行保留原始 ANSI 序列及已经追加的字素。
    let line = ""

    // 只记录当前行可见宽度，不把控制序列作为字符计数。
    let lineWidth = 0

    // 累计本段落的样式序列，自动换行后重放以延续颜色。
    let styles = ""

    // 捕获组保留颜色片段，避免拆断转义序列。
    for (const part of paragraph.split(ANSI_PARTS)) {
      if (part.startsWith("\u001B[")) {
        line += part
        styles += part

        continue
      }

      // 只在字素边界判断溢出，窄终端至少容纳一个完整字素。
      for (const { segment } of GRAPHEMES.segment(part)) {
        // 完整字素的列宽，避免拆开组合字符或 emoji。
        const segmentWidth = visibleWidth(segment)

        if (lineWidth > 0 && lineWidth + segmentWidth > Math.max(1, width)) {
          lines.push(styles === "" ? line : `${line}\u001B[0m`)
          line = styles
          lineWidth = 0
        }

        line += segment
        lineWidth += segmentWidth
      }
    }

    lines.push(line)
  }

  return lines
}
