<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-start py-5 px-2.5">
    <div class="w-full max-w-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <header class="bg-gradient-to-br from-primary to-primary-dark text-white p-6 text-center">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2.5">
            <img src="../school.svg" alt="东南大学校徽" class="h-10 w-auto object-contain">
            <h1 class="text-xl font-semibold m-0">校园接驳车实时查询</h1>
          </div>
          <div class="flex items-center gap-3">
            <button 
              @click="toggleTheme"
              class="p-2 rounded-lg hover:bg-white/10 transition-colors"
              :title="isDark ? '切换到浅色主题' : '切换到深色主题'"
            >
              <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646l-3-3a5 5 0 00-7.072 0l-3 3a5 5 0 000 7.072l3 3a5 5 0 007.072 0l3-3a5 5 0 000-7.072z" />
              </svg>
            </button>
            <div id="clock" class="text-lg opacity-90 font-light">{{ currentTime }}</div>
          </div>
        </div>
      </header>

      <div class="p-5 border-b border-gray-200 dark:border-gray-700">
        <div class="mb-4.5">
          <label class="block font-semibold mb-2.5 text-gray-600 dark:text-gray-300 text-base">选择查询模式：</label>
          <div class="flex rounded-lg overflow-hidden border border-primary">
            <label 
              v-for="mode in modes" 
              :key="mode.value"
              class="flex-1 text-center py-2.5 px-2 m-0 cursor-pointer font-semibold text-sm text-primary dark:text-gray-200 bg-white dark:bg-gray-700 transition-all duration-200 min-w-0 hover:bg-primary-light dark:hover:bg-gray-600"
              :class="{ '!bg-primary dark:!bg-blue-500 !text-white !font-bold shadow-inner': currentMode === mode.value }"
            >
              <input type="radio" :value="mode.value" v-model="currentMode" class="hidden">
              {{ mode.label }}
            </label>
          </div>
        </div>

        <div class="mb-4.5">
          <label class="block font-semibold mb-2.5 text-gray-600 dark:text-gray-300 text-base">选择日期类型：</label>
          <div class="flex rounded-lg overflow-hidden border border-primary">
            <label 
              v-for="day in dayTypes" 
              :key="day.value"
              class="flex-1 text-center py-2.5 px-2 m-0 cursor-pointer font-semibold text-base text-primary dark:text-gray-200 bg-white dark:bg-gray-700 transition-all duration-200 hover:bg-primary-light dark:hover:bg-gray-600"
              :class="{ '!bg-primary dark:!bg-blue-500 !text-white !font-bold shadow-inner': dayType === day.value }"
            >
              <input type="radio" :value="day.value" v-model="dayType" class="hidden">
              {{ day.label }}
            </label>
          </div>
        </div>

        <div v-if="currentMode === 'realtime'" class="mb-4.5">
          <label class="block font-semibold mb-2.5 text-gray-600 dark:text-gray-300 text-base">选择你的上车地点：</label>
          <select v-model="selectedLocation" class="w-full p-3 text-base rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-gray-800 appearance-none cursor-pointer transition-colors duration-300">
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>

        <div v-if="currentMode === 'destination'" class="mb-4.5">
          <label class="block font-semibold mb-2.5 text-gray-600 dark:text-gray-300 text-base">选择你的终点站：</label>
          <select v-model="selectedDestination" class="w-full p-3 text-base rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-gray-800 appearance-none cursor-pointer transition-colors duration-300">
            <option value="">请选择终点</option>
            <option v-for="dest in destinations" :key="dest" :value="dest">{{ dest }}</option>
          </select>
        </div>
      </div>

      <div v-if="currentMode === 'realtime' || currentMode === 'destination'" class="px-6 py-2.5 pb-6">
        <h2 class="my-2.5 mb-5 text-gray-600 dark:text-gray-300 border-b-2 border-gray-200 dark:border-gray-700 pb-2.5 font-semibold">
          {{ currentMode === 'realtime' ? '接下来的班车：' : '开往所选终点的班车：' }}
        </h2>
        
        <div v-if="!schedules" class="bg-primary-light dark:bg-gray-700 border border-primary dark:border-gray-600 text-primary-dark dark:text-gray-200 rounded-xl p-7.5 text-center text-base">
          正在加载数据…
        </div>
        
        <div v-else-if="!hasBusData" class="bg-primary-light dark:bg-gray-700 border border-primary dark:border-gray-600 text-primary-dark dark:text-gray-200 rounded-xl p-7.5 text-center text-base">
          {{ noBusMessage }}
        </div>
        
        <div v-else>
          <BusCard 
            v-for="(bus, index) in displayBuses" 
            :key="index"
            :bus="bus"
            :mode="currentMode"
            ref="busCardRefs"
            @set-alarm="setAlarm"
            @toggle-alarm-input="toggleAlarmInput"
            @cancel-alarm="cancelAlarm"
          />
        </div>
      </div>

      <div v-if="currentMode === 'all'" class="p-5">
        <div class="mb-5">
          <label class="block font-bold mb-2.5 text-gray-600 dark:text-gray-300">选择起点：</label>
          <select v-model="selectedAllLocation" class="w-full p-3 text-base rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-gray-800 appearance-none cursor-pointer transition-colors duration-300">
            <option value="ALL">-- 全部地点 --</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
        <ScheduleTable :schedules="filteredSchedules" />
      </div>

      <footer class="text-center py-5 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <p class="mb-2">数据基于2025年10月20日起执行的时刻表</p>
        <p>
          <a href="https://github.com/lovekang3344/SEU-BUS" target="_blank" class="hover:text-primary transition-colors" title="前往 GitHub 支持项目">
            <svg viewBox="0 0 16 16" width="16" height="16" class="inline-block align-text-bottom fill-current mr-1">
              <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82 2.27.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2.0-.21.15-.46.55-.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            如有帮助，请给我们点赞
          </a>
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import BusCard from './components/BusCard.vue'
import ScheduleTable from './components/ScheduleTable.vue'

const schedules = ref(null)
const currentTime = ref('')
const currentMode = ref('realtime')
const dayType = ref('workday')
const selectedLocation = ref('')
const selectedDestination = ref('')
const selectedAllLocation = ref('ALL')
const alarmList = ref({})
const busCardRefs = ref([])
const isDark = ref(false)

const modes = [
  { value: 'realtime', label: '实时查询' },
  { value: 'destination', label: '反向查询' },
  { value: 'all', label: '完整时刻表' }
]

const dayTypes = [
  { value: 'workday', label: '工作日' },
  { value: 'holiday', label: '节假日' }
]

const locations = computed(() => {
  if (!schedules.value || !schedules.value[dayType.value]) return []
  const locs = Object.keys(schedules.value[dayType.value])
  if (dayType.value === 'holiday') {
    return locs.filter(l => l !== '纪忠楼')
  }
  return locs
})

const destinations = computed(() => {
  if (!schedules.value || !schedules.value[dayType.value]) return []
  const allDestinations = new Set()
  Object.keys(schedules.value[dayType.value]).forEach(stop => {
    (schedules.value[dayType.value][stop] || []).forEach(bus => {
      allDestinations.add(bus.destination)
    })
  })
  return Array.from(allDestinations).sort()
})

const displayBuses = computed(() => {
  if (!schedules.value || !schedules.value[dayType.value]) return []
  
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  let list = []

  if (currentMode.value === 'realtime') {
    if (!selectedLocation.value) return []
    list = (schedules.value[dayType.value][selectedLocation.value] || []).map(b => ({
      ...b,
      waitTime: timeToMin(b.time) - nowMin,
      busMin: timeToMin(b.time),
      startLocation: selectedLocation.value
    })).filter(b => b.waitTime >= 0).sort((a, b) => a.busMin - b.busMin)
  } else if (currentMode.value === 'destination') {
    if (!selectedDestination.value) return []
    Object.keys(schedules.value[dayType.value]).forEach(stop => {
      (schedules.value[dayType.value][stop] || []).forEach(b => {
        if (b.destination === selectedDestination.value) {
          const busMin = timeToMin(b.time)
          const waitTime = busMin - nowMin
          if (waitTime >= 0) {
            list.push({
              ...b,
              waitTime,
              busMin,
              startLocation: stop
            })
          }
        }
      })
    })
    list.sort((a, b) => a.busMin - b.busMin)
  }

  return list.slice(0, 2)
})

const hasBusData = computed(() => {
  if (!schedules.value) return false
  if (currentMode.value === 'realtime' && !selectedLocation.value) return false
  if (currentMode.value === 'destination' && !selectedDestination.value) return false
  return displayBuses.value.length > 0
})

const noBusMessage = computed(() => {
  if (currentMode.value === 'realtime' && !selectedLocation.value) {
    return '请选择一个上车地点'
  }
  if (currentMode.value === 'destination' && !selectedDestination.value) {
    return '请选择一个终点站'
  }
  if (currentMode.value === 'realtime') {
    return `今日 ${selectedLocation.value} 已无班车`
  }
  return `今日已无班车开往 ${selectedDestination.value}`
})

const filteredSchedules = computed(() => {
  if (!schedules.value || !schedules.value[dayType.value]) return {}
  
  const stops = Object.keys(schedules.value[dayType.value])
    .filter(stop => selectedAllLocation.value === 'ALL' || stop === selectedAllLocation.value)
    .sort()

  const result = {}
  stops.forEach(stop => {
    result[stop] = schedules.value[dayType.value][stop]
  })
  return result
})

function timeToMin(str) {
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
}

function generateBusKey(bus, loc) {
  return `${loc}-${bus.time}-${bus.destination}`
}

async function loadScheduleData() {
  try {
    const res = await fetch('/SEU-BUS/time.json')
    if (!res.ok) throw new Error(res.status)
    const raw = await res.json()
    schedules.value = expandLoopBuses(raw)
  } catch (e) {
    console.error('加载时刻表失败:', e)
    schedules.value = { workday: {}, holiday: {} }
  }
}

function expandLoopBuses(src) {
  const out = { workday: {}, holiday: {} }
  const days = ['workday', 'holiday']
  days.forEach(day => {
    out[day] = {}
    const dayData = src[day] || {}
    const stops = Object.keys(dayData)
    stops.forEach(stop => {
      out[day][stop] = []
      const buses = dayData[stop] || []
      buses.forEach(rec => {
        if (rec.time.includes('-')) {
          const [start, end] = rec.time.split('-')
          let t = timeToMin(start)
          const endMin = timeToMin(end)
          while (t <= endMin) {
            out[day][stop].push({
              time: minToTime(t),
              destination: rec.destination,
              notes: rec.notes,
              isLoop: true
            })
            t += 5
          }
        } else {
          out[day][stop].push(rec)
        }
      })
    })
  })
  return out
}

function minToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

async function isHoliday(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  try {
    const response = await fetch(`https://timor.tech/api/holiday/info/${dateStr}`)
    const data = await response.json()
    
    if (data.code === 0) {
      const holiday = data.holiday
      if (holiday) {
        return holiday.holiday
      }
    }
    
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  } catch (error) {
    console.error('获取节假日信息失败:', error)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }
}

function updateClock() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
}

async function autoDetectDayType() {
  try {
    const now = new Date()
    const isHolidayDay = await isHoliday(now)
    dayType.value = isHolidayDay ? 'holiday' : 'workday'
  } catch (error) {
    console.error('自动检测失败:', error)
    dayType.value = 'workday'
  }
}

function setAlarm(busKey, busTime, busDest, busLoc, minutes) {
  const now = new Date()
  const [h, m] = busTime.split(':').map(Number)
  const busDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  const alarmTime = busDate.getTime() - (minutes * 60 * 1000)
  const delayMs = alarmTime - now.getTime()

  if (delayMs <= 0) {
    alert('提醒设置失败！该班车时间已过，无法设置提醒。')
    return
  }

  clearTimeout(alarmList.value[busKey])
  delete alarmList.value[busKey]

  alarmList.value[busKey] = setTimeout(() => {
    triggerAlarm(busLoc, busDest, busTime, minutes)
    delete alarmList.value[busKey]
  }, delayMs)

  const countdownSeconds = Math.floor(delayMs / 1000)
  const busCardIndex = displayBuses.value.findIndex(bus => 
    `${bus.startLocation}-${bus.time}-${bus.destination}` === busKey
  )
  if (busCardIndex !== -1 && busCardRefs.value[busCardIndex]) {
    busCardRefs.value[busCardIndex].startCountdown(countdownSeconds)
  }

  const actualTime = new Date(alarmTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  alert(`✅ 提醒设置成功！\n\n提醒将于 ${actualTime} 触发。\n- 提醒时间: 提前 ${minutes} 分钟\n- 班车时间: ${busTime}`)
}

function triggerAlarm(busLoc, busDest, busTime, minutes) {
  const message = `📢 班车提醒！\n\n${busLoc} 开往 ${busDest} 的班车(${busTime}) 将在 ${minutes} 分钟后发车。`
  
  playAlarmSound()
  vibrateDevice()
  
  setTimeout(() => {
    alert(message)
  }, 100)
}

function playAlarmSound() {
  try {
    console.log('开始播放提醒声音')
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) {
      console.warn('当前浏览器不支持Web Audio API')
      return
    }
    
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = 0.3
    
    oscillator.start()
    
    setTimeout(() => {
      oscillator.stop()
      audioContext.close()
      console.log('第一声播放完成')
    }, 500)
    
    setTimeout(() => {
      const audioContext2 = new AudioContext()
      const oscillator2 = audioContext2.createOscillator()
      const gainNode2 = audioContext2.createGain()
      
      oscillator2.connect(gainNode2)
      gainNode2.connect(audioContext2.destination)
      
      oscillator2.frequency.value = 800
      oscillator2.type = 'sine'
      gainNode2.gain.value = 0.3
      
      oscillator2.start()
      
      setTimeout(() => {
        oscillator2.stop()
        audioContext2.close()
        console.log('第二声播放完成')
      }, 500)
    }, 600)
  } catch (error) {
    console.error('播放提醒声音失败:', error)
  }
}

function vibrateDevice() {
  if ('vibrate' in navigator) {
    console.log('开始震动')
    try {
      navigator.vibrate([200, 100, 200, 100, 200, 100, 200])
      console.log('震动成功')
    } catch (error) {
      console.error('震动失败:', error)
    }
  } else {
    console.warn('当前浏览器不支持震动功能')
  }
}

function cancelAlarm(busKey) {
  clearTimeout(alarmList.value[busKey])
  delete alarmList.value[busKey]
  
  const busCardIndex = displayBuses.value.findIndex(bus => 
    `${bus.startLocation}-${bus.time}-${bus.destination}` === busKey
  )
  if (busCardIndex !== -1 && busCardRefs.value[busCardIndex]) {
    busCardRefs.value[busCardIndex].stopCountdown()
  }
  
  alert('提醒已取消')
}

function toggleAlarmInput(busKey) {
  const card = document.querySelector(`[data-bus-key="${busKey}"]`)
  if (card) {
    const inputGroup = card.querySelector('.alarm-input-group')
    if (inputGroup) {
      inputGroup.style.display = inputGroup.style.display === 'flex' ? 'none' : 'flex'
      if (inputGroup.style.display === 'flex') {
        const input = inputGroup.querySelector('input')
        if (input) input.focus()
      }
    }
  }
}

let clockInterval
onMounted(async () => {
  await loadScheduleData()
  await autoDetectDayType()
  
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else if (savedTheme === 'light') {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDark.value = prefersDark
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  }
  
  updateClock()
  clockInterval = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  clearInterval(clockInterval)
  Object.values(alarmList.value).forEach(clearTimeout)
})

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

watch([currentMode, dayType, selectedLocation, selectedDestination, selectedAllLocation], () => {
  if (currentMode.value === 'realtime' && selectedLocation.value === '' && locations.value.length > 0) {
    if (locations.value.includes('兰台')) {
      selectedLocation.value = '兰台'
    } else {
      selectedLocation.value = locations.value[0]
    }
  }
}, { immediate: true })
</script>
