// Expand loop time ranges into individual bus entries
export function expandLoopBuses(src) {
  if (!src || typeof src !== 'object') {
    console.error('[expandLoopBuses] Invalid input:', src)
    return { workday: {}, holiday: {} }
  }

  const out = { workday: {}, holiday: {} }

  // Process workday
  if (src.workday) {
    out.workday = expandDayData(src.workday)
  }

  // Process holiday
  if (src.holiday) {
    out.holiday = expandDayData(src.holiday)
  }

  return out
}

function expandDayData(dayData) {
  if (!dayData || typeof dayData !== 'object') {
    return {}
  }

  const result = {}
  const stopNames = Object.keys(dayData)

  for (let i = 0; i < stopNames.length; i++) {
    const stop = stopNames[i]
    const buses = dayData[stop]

    if (!Array.isArray(buses)) {
      result[stop] = []
      continue
    }

    result[stop] = []

    for (let j = 0; j < buses.length; j++) {
      const rec = buses[j]
      if (!rec || !rec.time) continue

      if (rec.time.includes('-')) {
        // Expand loop notation
        const parts = rec.time.split('-')
        const startTime = timeToMin(parts[0])
        const endTime = timeToMin(parts[1])
        let t = startTime
        while (t <= endTime) {
          result[stop].push({
            time: minToTimeStr(t),
            destination: rec.destination,
            notes: rec.notes,
            isLoop: true
          })
          t += 5
        }
      } else {
        result[stop].push(rec)
      }
    }
  }

  return result
}

function timeToMin(str) {
  const parts = str.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  return h * 60 + m
}

function minToTimeStr(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}
