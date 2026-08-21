const fs = require('fs')
const path = require('path')

const src = path.resolve(__dirname, '../public/time.json')
const dst = path.resolve(__dirname, '../src/utils/scheduleData.js')

if (!fs.existsSync(src)) {
  console.error('[embed-schedule] time.json not found at', src)
  process.exit(1)
}

const raw = fs.readFileSync(src, 'utf-8')
const b64 = Buffer.from(raw).toString('base64')

const content = `// Auto-generated — do not edit. Embeds time.json as base64.
export const SCHEDULE_DATA_BASE64 = ${JSON.stringify(b64)}

export function getScheduleData() {
  return JSON.parse(atob(SCHEDULE_DATA_BASE64))
}
`

fs.writeFileSync(dst, content, 'utf-8')
console.log(`[embed-schedule] Embedded ${raw.length} bytes → ${b64.length} chars base64`)
