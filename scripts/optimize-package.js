// Post-build script to optimize package size
const fs = require('fs')
const path = require('path')

const releasePath = path.join(__dirname, '..', 'release', 'win-unpacked')

if (!fs.existsSync(releasePath)) {
  console.log('Release folder not found, skipping optimization')
  process.exit(0)
}

// Keep only Chinese and English locales
const localesDir = path.join(releasePath, 'locales')
if (fs.existsSync(localesDir)) {
  const files = fs.readdirSync(localesDir)
  const keep = ['zh-CN.pak', 'en-US.pak', 'en-GB.pak']

  let removed = 0
  files.forEach(file => {
    if (!keep.includes(file)) {
      fs.unlinkSync(path.join(localesDir, file))
      removed++
    }
  })
  console.log(`Removed ${removed} unnecessary locale files`)
}

// Calculate size savings
const totalSize = fs.statSync(releasePath).size
console.log(`Optimization complete. Total unpacked size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`)
