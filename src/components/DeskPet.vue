<template>
  <div class="desk-pet" :class="{ 'is-alarming': isAlarming }">
    <!-- Squirrel character -->
    <div
      class="squirrel"
      :class="[animState, { dragging: isDragging }]"
      @mousedown="startDrag"
      @click="onSquirrelClick"
    >
      <!-- Speech bubble with care message -->
      <transition name="pop">
        <div v-if="showSpeech && !showDetail" class="speech-bubble">
          {{ currentSpeech }}
        </div>
      </transition>

      <!-- Tooltip: next bus info on hover -->
      <transition name="pop">
        <div v-if="showTooltip && !showDetail && nextBusInfo" class="tooltip">
          <div class="tooltip-time">{{ nextBusInfo.time }}</div>
          <div class="tooltip-wait">{{ nextBusInfo.waitText }}</div>
          <div class="tooltip-route">{{ userLocation }} → {{ userDestination }}</div>
        </div>
      </transition>

      <!-- Squirrel SVG -->
      <svg viewBox="0 0 100 100" class="squirrel-svg">
        <!-- Tail -->
        <ellipse cx="82" cy="72" rx="18" ry="22" fill="#C67B30" transform="rotate(25, 82, 72)"/>
        <ellipse cx="82" cy="72" rx="12" ry="16" fill="#D4956B" transform="rotate(25, 82, 72)"/>

        <!-- Body -->
        <ellipse cx="50" cy="72" rx="26" ry="22" fill="#C67B30"/>
        <ellipse cx="50" cy="76" rx="18" ry="14" fill="#F5DEB3"/>

        <!-- Feet -->
        <ellipse cx="36" cy="90" rx="8" ry="4" fill="#8B5A2B"/>
        <ellipse cx="64" cy="90" rx="8" ry="4" fill="#8B5A2B"/>

        <!-- Arms -->
        <ellipse cx="26" cy="66" rx="7" ry="5" fill="#C67B30" transform="rotate(-15, 26, 66)"/>
        <ellipse cx="74" cy="66" rx="7" ry="5" fill="#C67B30" transform="rotate(15, 74, 66)"/>
        <circle cx="26" cy="66" r="3" fill="#F5DEB3"/>
        <circle cx="74" cy="66" r="3" fill="#F5DEB3"/>

        <!-- Head -->
        <circle cx="50" cy="42" r="24" fill="#C67B30"/>

        <!-- Ears -->
        <ellipse cx="30" cy="22" rx="7" ry="9" fill="#A0522D"/>
        <ellipse cx="30" cy="22" rx="4" ry="5" fill="#FFB6C1"/>
        <ellipse cx="70" cy="22" rx="7" ry="9" fill="#A0522D"/>
        <ellipse cx="70" cy="22" rx="4" ry="5" fill="#FFB6C1"/>

        <!-- SEU Cap -->
        <path d="M 28 32 Q 50 10 72 32" fill="#005a9c" stroke="#004a80" stroke-width="1"/>
        <rect x="26" y="30" width="48" height="6" rx="2" fill="#005a9c"/>
        <rect x="22" y="34" width="56" height="4" rx="2" fill="#004a80"/>

        <!-- Face -->
        <ellipse cx="38" cy="46" rx="7" ry="5" fill="#F5DEB3"/>
        <ellipse cx="62" cy="46" rx="7" ry="5" fill="#F5DEB3"/>

        <!-- Eyes -->
        <circle cx="42" cy="40" r="6" fill="white"/>
        <circle cx="58" cy="40" r="6" fill="white"/>
        <circle cx="43" cy="41" r="4" fill="#1a1a2e"/>
        <circle cx="59" cy="41" r="4" fill="#1a1a2e"/>
        <circle cx="44.5" cy="39" r="1.5" fill="white"/>
        <circle cx="60.5" cy="39" r="1.5" fill="white"/>

        <!-- Nose -->
        <ellipse cx="50" cy="50" rx="3" ry="2" fill="#1a1a2e"/>

        <!-- Mouth -->
        <path d="M 47 54 Q 50 58 53 54" stroke="#8B5A2B" stroke-width="1.5" fill="none" stroke-linecap="round"/>

        <!-- Teeth -->
        <rect x="48.5" y="54" width="3" height="4" rx="1" fill="white"/>

        <!-- Whiskers -->
        <line x1="20" y1="46" x2="34" y2="47" stroke="#8B5A2B" stroke-width="0.8" opacity="0.4"/>
        <line x1="20" y1="50" x2="34" y2="50" stroke="#8B5A2B" stroke-width="0.8" opacity="0.4"/>
        <line x1="66" y1="47" x2="80" y2="46" stroke="#8B5A2B" stroke-width="0.8" opacity="0.4"/>
        <line x1="66" y1="50" x2="80" y2="50" stroke="#8B5A2B" stroke-width="0.8" opacity="0.4"/>
      </svg>
    </div>

    <!-- Detail panel -->
    <transition name="slide-down">
      <div v-if="showDetail" class="detail-panel">
        <div v-if="loading" class="detail-content">
          <div class="loading-text">加载中...</div>
        </div>
        <div v-else-if="loadError" class="detail-content">
          <div class="error-text">{{ loadError }}</div>
        </div>
        <div v-else class="detail-content">
          <!-- 设置按钮放在顶部 -->
          <div class="panel-header">
            <span class="route-label">{{ userLocation }} → {{ userDestination }}</span>
            <button class="settings-btn" @click.stop="showSettings = !showSettings">⚙️ 设置</button>
          </div>

          <!-- 设置面板 -->
          <transition name="pop">
            <div v-if="showSettings" class="settings-box">
              <div class="setting-row">
                <label>上车地点</label>
                <select v-model="settingsLocation">
                  <option v-for="loc in availableLocations" :key="loc" :value="loc">{{ loc }}</option>
                </select>
              </div>
              <div class="setting-row">
                <label>终点站</label>
                <select v-model="settingsDestination">
                  <option v-for="dest in availableSettingsDestinations" :key="dest" :value="dest">{{ dest }}</option>
                </select>
              </div>
              <div class="setting-row">
                <label>提前提醒</label>
                <input type="number" v-model.number="settingsReminder" min="1" max="15" class="num-input"/>
                <span class="unit">分钟</span>
              </div>
              <button class="save-btn" @click.stop="saveSettings">保存</button>
            </div>
          </transition>

          <!-- 下一班车信息 -->
          <div v-if="nextBusInfo" class="next-bus">
            <div class="next-label">下一班</div>
            <div class="next-time">{{ nextBusInfo.time }}</div>
            <div class="next-wait">{{ nextBusInfo.waitText }}</div>
            <button class="alarm-btn next-alarm" :class="{ active: nextBusInfo.alarmSet }" @click.stop="toggleAlarmForBus(nextBusInfo)">
              {{ nextBusInfo.alarmSet ? '🔕 取消' : '🔔 提醒' }}
            </button>
          </div>

          <!-- 即将发车列表（排除下一班）-->
          <div v-if="upcomingBuses.length > 1" class="bus-section">
            <div class="section-title">后续班车</div>
            <div v-for="bus in upcomingBuses.slice(1, 3)" :key="bus.key" class="bus-row">
              <span class="bus-time">{{ bus.time }}</span>
              <span class="bus-wait">{{ bus.waitText }}</span>
              <button class="alarm-btn" :class="{ active: bus.alarmSet }" @click.stop="toggleAlarmForBus(bus)">
                {{ bus.alarmSet ? '🔕' : '🔔' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Alarm toast -->
    <transition name="pop">
      <div v-if="isAlarming" class="alarm-toast">
        <div class="toast-icon">🔔</div>
        <div class="toast-text">{{ alarmMessage }}</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getDayType } from '../utils/holidays.js'
import { getScheduleData } from '../utils/scheduleData.js'
import { expandLoopBuses } from '../utils/expandSchedules.js'

const userLocation = ref('橘园')
const userDestination = ref('无线谷')
const reminderMinutes = ref(5)
const dayType = ref('workday')
const rawSchedules = ref(null)
const loading = ref(true)
const loadError = ref('')
const showDetail = ref(false)
const showSettings = ref(false)
const settingsLocation = ref('橘园')
const settingsDestination = ref('无线谷')
const settingsReminder = ref(5)
const showTooltip = ref(false)
const isAlarming = ref(false)
const alarmMessage = ref('')
const tooltipTimer = ref(null)

// Animation states
const animState = ref('idle') // idle, walk, hop
let animTimer = null

// Speech bubble
const showSpeech = ref(false)
const currentSpeech = ref('')
const speechTimer = ref(null)
const careMessages = ref([
  '学习辛苦啦，记得休息一下~',
  '喝口水歇歇吧！',
  '眼看久了记得远眺~',
  '坐久了起来走走',
  '别久坐哦，健康第一',
  '注意休息，劳逸结合',
])

// Drag state
let isDragging = false
let clickStart = { x: 0, y: 0 }
let dragStart = { x: 0, y: 0 }
let windowStart = [0, 0]
let hasMoved = false
let dragReady = false

const alarmTimers = ref({})

// --- Config ---
async function loadConfig() {
  if (window.electronAPI) {
    try {
      const config = await window.electronAPI.getConfig()
      if (config.location) userLocation.value = config.location
      if (config.destination) userDestination.value = config.destination
      if (config.reminderMinutes) reminderMinutes.value = config.reminderMinutes
      // Initialize windowStart immediately from saved config to prevent first-click jump
      if (config.x != null && config.y != null) {
        windowStart = [config.x, config.y]
        console.log('[DeskPet] windowStart initialized from config:', windowStart)
      }
    } catch (e) { console.error(e) }
  }
}

async function saveSettingsToElectron() {
  if (window.electronAPI) {
    await window.electronAPI.saveConfig({
      location: userLocation.value,
      destination: userDestination.value,
      reminderMinutes: reminderMinutes.value,
    })
  }
}

// --- Schedule ---
function timeToMin(str) {
  const parts = str.split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}
function minToTimeStr(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

const currentMin = computed(() => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
})

const availableLocations = computed(() => {
  if (!rawSchedules.value) return ['兰台']
  const dayData = rawSchedules.value[dayType.value] || rawSchedules.value.workday || {}
  return Object.keys(dayData).sort()
})

const availableDestinations = computed(() => {
  if (!rawSchedules.value) return []
  const dests = new Set()
  const dayData = rawSchedules.value[dayType.value] || rawSchedules.value.workday || {}
  const buses = dayData[userLocation.value] || []
  buses.forEach(b => dests.add(b.destination))
  return Array.from(dests).sort()
})

const availableSettingsDestinations = computed(() => {
  if (!rawSchedules.value) return []
  const dests = new Set()
  const dayData = rawSchedules.value[dayType.value] || rawSchedules.value.workday || {}
  const buses = dayData[settingsLocation.value] || []
  buses.forEach(b => dests.add(b.destination))
  return Array.from(dests).sort()
})

const nextBusInfo = computed(() => {
  if (!rawSchedules.value || !userLocation.value) return null
  const dayData = rawSchedules.value[dayType.value] || rawSchedules.value.workday || {}
  const buses = dayData[userLocation.value] || []
  const nowMin = currentMin.value
  for (const bus of buses) {
    const busMin = timeToMin(bus.time)
    if (busMin >= nowMin) {
      const wait = busMin - nowMin
      return {
        time: bus.time,
        waitText: wait === 0 ? '即将发车！' : `${wait} 分钟后`,
        key: `${userLocation.value}-${bus.time}-${bus.destination}`,
        alarmSet: !!alarmTimers.value[`${userLocation.value}-${bus.time}-${bus.destination}`],
      }
    }
  }
  return null
})

const upcomingBuses = computed(() => {
  if (!rawSchedules.value || !userLocation.value) return []
  const dayData = rawSchedules.value[dayType.value] || rawSchedules.value.workday || {}
  const buses = dayData[userLocation.value] || []
  const nowMin = currentMin.value
  const result = []
  for (const bus of buses) {
    const busMin = timeToMin(bus.time)
    if (busMin >= nowMin) {
      const wait = busMin - nowMin
      result.push({
        ...bus,
        wait,
        waitText: wait === 0 ? '即将发车' : `${wait}分钟`,
        key: `${userLocation.value}-${bus.time}-${bus.destination}`,
        alarmSet: !!alarmTimers.value[`${userLocation.value}-${bus.time}-${bus.destination}`],
      })
    }
    if (result.length >= 5) break
  }
  return result
})

const pastBuses = computed(() => {
  if (!rawSchedules.value || !userLocation.value) return []
  const dayData = rawSchedules.value[dayType.value] || rawSchedules.value.workday || {}
  const buses = dayData[userLocation.value] || []
  const nowMin = currentMin.value
  const result = []
  for (const bus of buses) {
    if (timeToMin(bus.time) < nowMin) {
      result.push({ ...bus, key: `${userLocation.value}-${bus.time}-${bus.destination}` })
    }
  }
  return result.slice(-3)
})

async function loadScheduleDataViaIPC() {
  if (!window.electronAPI?.loadScheduleData) return null
  for (let i = 0; i < 3; i++) {
    try {
      const result = await window.electronAPI.loadScheduleData()
      if (result) return result
    } catch (e) {
      console.warn(`[DeskPet] IPC attempt ${i + 1} failed:`, e)
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return null
}

async function loadScheduleDataViaFetch() {
  try {
    const res = await fetch('time.json')
    if (res.ok) {
      const raw = await res.json()
      console.log('[DeskPet] Fetch loaded:', raw ? `loaded ${Object.keys(raw.workday || {}).length} stops` : null)
      return raw
    }
    console.warn('[DeskPet] Fetch returned status:', res.status)
  } catch (e) {
    console.error('[DeskPet] Fetch failed:', e)
  }
  return null
}

async function loadSchedules() {
  let raw = null

  console.log('[DeskPet] Starting loadSchedules')
  console.log('[DeskPet] electronAPI available:', !!window.electronAPI)
  console.log('[DeskPet] getScheduleData available:', typeof getScheduleData)

  try {
    raw = await loadScheduleDataViaIPC()
    console.log('[DeskPet] IPC result:', raw ? `loaded ${Object.keys(raw.workday || {}).length} stops` : null)
  } catch (e) {
    console.error('[DeskPet] IPC error:', e)
  }

  if (!raw) {
    console.log('[DeskPet] IPC returned null, trying fetch fallback')
    try {
      raw = await loadScheduleDataViaFetch()
    } catch (e) {
      console.error('[DeskPet] Fetch error:', e)
    }
  }

  if (!raw) {
    console.log('[DeskPet] Trying embedded fallback...')
    try {
      const embeddedData = getScheduleData()
      console.log('[DeskPet] Embedded data raw:', embeddedData)
      console.log('[DeskPet] Embedded data keys:', Object.keys(embeddedData || {}))
      raw = embeddedData
      console.log('[DeskPet] Embedded fallback loaded:', raw ? `loaded ${Object.keys(raw.workday || {}).length} stops` : null)
    } catch (e) {
      console.error('[DeskPet] Embedded fallback failed:', e)
    }
  }

  if (raw) {
    rawSchedules.value = expandLoopBuses(raw)
    loadError.value = ''
    console.log('[DeskPet] Schedules expanded, workday stops:', Object.keys(rawSchedules.value.workday).length)
  } else {
    rawSchedules.value = { workday: {}, holiday: {} }
    loadError.value = '数据加载失败，请检查文件是否存在'
    console.error('[DeskPet] No data loaded from any source')
  }
  loading.value = false
  console.log('[DeskPet] loadSchedules done, loading=', loading.value)
}

// --- Animations ---
function randomAnimation() {
  const states = ['idle', 'idle', 'idle', 'walk', 'hop']
  const state = states[Math.floor(Math.random() * states.length)]
  animState.value = state

  clearTimeout(animTimer)
  const duration = state === 'walk' ? 2000 : state === 'hop' ? 800 : 3000 + Math.random() * 4000
  animTimer = setTimeout(randomAnimation, duration)
}

function startIdleAnimations() {
  randomAnimation()

  // Care messages every 10-20 minutes
  function scheduleCareMessage() {
    const delay = 10 + Math.random() * 10 // 10-20 minutes
    setTimeout(() => {
      if (!showDetail.value) {
        showCareMessage()
      }
      scheduleCareMessage()
    }, delay * 60 * 1000)
  }
  scheduleCareMessage()
}

function showCareMessage() {
  currentSpeech.value = careMessages.value[Math.floor(Math.random() * careMessages.value.length)]
  showSpeech.value = true
  clearTimeout(speechTimer.value)
  speechTimer.value = setTimeout(() => {
    showSpeech.value = false
  }, 4000)
}

// --- Tooltip ---
function showTooltipTemporarily() {
  showTooltip.value = true
  clearTimeout(tooltipTimer.value)
  tooltipTimer.value = setTimeout(() => {
    if (!showDetail.value) showTooltip.value = false
  }, 4000)
}

// --- Click vs Drag ---
function onSquirrelClick(e) {
  if (hasMoved) return
  toggleDetail()
}

// --- Drag ---
function startDrag(e) {
  clickStart = { x: e.screenX, y: e.screenY }
  dragStart = { x: e.screenX, y: e.screenY }
  hasMoved = false
  isDragging = false
  dragReady = true
}

function onDragMove(e) {
  if (!dragReady) return
  if (!isDragging) {
    const dx = e.screenX - clickStart.x
    const dy = e.screenY - clickStart.y
    if (dx * dx + dy * dy > 25) { // 5px threshold
      isDragging = true
      hasMoved = true
      // Fetch window position asynchronously
      if (window.electronAPI) {
        window.electronAPI.getWindowPosition().then(pos => {
          windowStart = pos || [0, 0]
        }).catch(() => {
          windowStart = [clickStart.x, clickStart.y]
        })
      }
    }
    return
  }
  if (!window.electronAPI) return
  const dx = e.screenX - dragStart.x
  const dy = e.screenY - dragStart.y
  const newX = (windowStart[0] ?? 0) + dx
  const newY = (windowStart[1] ?? 0) + dy
  window.electronAPI.setWindowPosition(newX, newY)
}

function onDragEnd() {
  isDragging = false
  dragReady = false
}

// --- Alarm ---
function toggleAlarmForBus(bus) {
  const key = bus.key
  if (alarmTimers.value[key]) {
    clearTimeout(alarmTimers.value[key])
    delete alarmTimers.value[key]
    alarmTimers.value = { ...alarmTimers.value }
    return
  }
  const now = new Date()
  const [h, m] = bus.time.split(':').map(Number)
  const busDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
  const alarmTime = busDate.getTime() - (reminderMinutes.value * 60 * 1000)
  const delayMs = alarmTime - now.getTime()
  if (delayMs <= 0) { playAlarmSound(); return }
  alarmTimers.value[key] = setTimeout(() => {
    triggerAlarm(bus)
    delete alarmTimers.value[key]
    alarmTimers.value = { ...alarmTimers.value }
  }, delayMs)
  alarmTimers.value = { ...alarmTimers.value }
}

function triggerAlarm(bus) {
  isAlarming.value = true
  alarmMessage.value = `${bus.time} 发车，还有 ${reminderMinutes.value} 分钟！`
  playAlarmSound()
  showDetail.value = true
  setTimeout(() => { isAlarming.value = false }, 8000)
}

function playAlarmSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 600; osc.type = 'triangle'
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    osc.start()
    setTimeout(() => { osc.stop(); ctx.close() }, 500)
  } catch (e) { console.error(e) }
}

// --- Settings ---
function saveSettings() {
  userLocation.value = settingsLocation.value
  userDestination.value = settingsDestination.value
  reminderMinutes.value = settingsReminder.value
  saveSettingsToElectron()
  showSettings.value = false
  Object.values(alarmTimers.value).forEach(clearTimeout)
  alarmTimers.value = {}
}

function toggleDetail() {
  showDetail.value = !showDetail.value
  showSettings.value = false
  if (!showDetail.value) showTooltip.value = false
  // Don't resize window - just toggle visibility
}

// --- Lifecycle ---
onMounted(async () => {
  console.log('[DeskPet] onMounted fired')
  // Initialize window start position immediately
  if (window.electronAPI?.getWindowPosition) {
    window.electronAPI.getWindowPosition().then(pos => {
      windowStart = pos || [0, 0]
      console.log('[DeskPet] Initial window position:', windowStart)
    }).catch(() => {
      windowStart = [0, 0]
    })
  }
  try {
    await loadConfig()
  } catch (e) {
    console.error('[DeskPet] loadConfig error:', e)
  }
  dayType.value = getDayType(new Date())
  try {
    await loadSchedules()
  } catch (e) {
    console.error('[DeskPet] loadSchedules error:', e)
    rawSchedules.value = { workday: {}, holiday: {} }
    loadError.value = '数据加载失败，请检查文件是否存在'
    loading.value = false
  }
  settingsLocation.value = userLocation.value
  settingsDestination.value = userDestination.value
  settingsReminder.value = reminderMinutes.value

  const container = document.querySelector('.desk-pet')
  if (container) {
    container.addEventListener('mouseenter', () => {
      showTooltipTemporarily()
    })
    container.addEventListener('mouseleave', () => {
      if (!showDetail.value) showTooltip.value = false
    })
  }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)

  // Start idle animations
  startIdleAnimations()

  if (window.electronAPI?.onConfigLoaded) {
    window.electronAPI.onConfigLoaded((config) => {
      if (config.location) userLocation.value = config.location
      if (config.destination) userDestination.value = config.destination
      if (config.reminderMinutes) reminderMinutes.value = config.reminderMinutes
      settingsLocation.value = userLocation.value
      settingsDestination.value = userDestination.value
      settingsReminder.value = reminderMinutes.value
    })
  }
})

onUnmounted(() => {
  clearTimeout(animTimer)
  clearTimeout(speechTimer.value)
  clearTimeout(tooltipTimer.value)
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})
</script>

<style scoped>
/* ===== Container ===== */
.desk-pet {
  position: relative;
  width: 100%;
  height: 100vh;
  user-select: none;
  overflow: hidden;
  pointer-events: none; /* Allow clicks to pass through container */
}

/* ===== Squirrel Character ===== */
.squirrel {
  position: absolute;
  top: 160px;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  cursor: grab;
  pointer-events: auto; /* Enable interactions on squirrel itself */
  transition: transform 0.1s ease;
}
.squirrel:active { cursor: grabbing; }
.squirrel.dragging { cursor: grabbing; }

/* Idle bobbing */
.squirrel.idle {
  animation: bob 2s ease-in-out infinite;
}
@keyframes bob {
  0%, 100% { transform: translate(-50%, -50%) translateY(0); }
  50% { transform: translate(-50%, -50%) translateY(-5px); }
}

/* Walking animation */
.squirrel.walk {
  animation: walk 0.3s ease-in-out infinite;
}
@keyframes walk {
  0%, 100% { transform: translate(-50%, -50%) rotate(-5deg); }
  50% { transform: translate(-50%, -50%) rotate(5deg); }
}

/* Hopping animation */
.squirrel.hop {
  animation: hop 0.4s ease-out;
}
@keyframes hop {
  0% { transform: translate(-50%, -50%) scale(1, 1); }
  30% { transform: translate(-50%, -50%) scale(1.1, 0.85); }
  50% { transform: translate(-50%, -60%) scale(0.95, 1.05); }
  100% { transform: translate(-50%, -50%) scale(1, 1); }
}

.squirrel-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
}

/* ===== Speech Bubble ===== */
.speech-bubble {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  padding: 6px 12px;
  font-size: 11px;
  color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  white-space: nowrap;
  z-index: 10;
}
.speech-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid white;
}

/* ===== Tooltip ===== */
.tooltip {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 10px;
  padding: 8px 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  text-align: center;
  min-width: 100px;
  z-index: 10;
}
.tooltip-time {
  font-size: 22px;
  font-weight: 700;
  color: #005a9c;
}
.tooltip-wait {
  font-size: 11px;
  color: #d9534f;
  font-weight: 600;
}
.tooltip-route {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}

/* ===== Detail Panel ===== */
.detail-panel {
  position: absolute;
  top: 260px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  background: white;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 20;
  border: 1px solid #eee;
  pointer-events: auto;
}

.detail-content {
  max-height: 340px;
  overflow-y: auto;
  padding: 12px 14px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}
.route-label {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}
.detail-content::-webkit-scrollbar {
  width: 4px;
}
.detail-content::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}
.loading-text, .error-text, .empty-text {
  text-align: center;
  color: #999;
  font-size: 12px;
  padding: 20px 0;
}
.error-text { color: #d9534f; }

.next-bus {
  text-align: center;
  padding: 10px;
  background: linear-gradient(135deg, #e6f0f7, #f0f7ff);
  border-radius: 10px;
  margin-bottom: 10px;
  border: 1px solid #005a9c;
}
.next-label {
  font-size: 10px;
  color: #005a9c;
  font-weight: 700;
  letter-spacing: 1px;
}
.next-time {
  font-size: 28px;
  font-weight: 800;
  color: #005a9c;
  line-height: 1.1;
}
.next-wait {
  font-size: 12px;
  color: #d9534f;
  font-weight: 600;
}

.bus-section { margin-bottom: 8px; }
.section-title {
  font-size: 10px;
  color: #aaa;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.past-title { margin-top: 8px; }

.bus-row {
  display: flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 6px;
  margin-bottom: 2px;
  transition: background 0.15s;
}
.bus-row:hover { background: #f5f5f5; }
.bus-time { font-weight: 700; color: #005a9c; font-size: 12px; width: 40px; }
.bus-wait { flex: 1; font-size: 11px; color: #888; }
.alarm-btn {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 12px;
}
.alarm-btn.active { background: #005a9c; border-color: #005a9c; }
.next-alarm {
  margin-top: 6px;
  font-size: 11px;
  padding: 3px 10px;
}

.past-row { display: flex; flex-wrap: wrap; gap: 4px; }
.past-tag { font-size: 10px; color: #bbb; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }

.settings-divider {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  pointer-events: auto;
}
.settings-btn {
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 0;
}
.settings-btn:hover { color: #005a9c; }

.settings-box {
  margin-top: 8px;
  padding: 10px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #eee;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.setting-row label { font-size: 11px; color: #777; }
.setting-row select, .num-input {
  padding: 3px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  background: white;
}
.num-input { width: 44px; text-align: center; }
.unit { font-size: 10px; color: #aaa; margin-left: 2px; }
.save-btn {
  display: block;
  width: 100%;
  background: #005a9c;
  color: white;
  border: none;
  padding: 5px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}
.save-btn:hover { background: #004a80; }

/* ===== Alarm Toast ===== */
.alarm-toast {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #ff6b8a, #ff4757);
  color: white;
  padding: 8px 16px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
  z-index: 30;
  white-space: nowrap;
}
.toast-icon { font-size: 18px; animation: bounce 0.5s ease-in-out infinite alternate; }
@keyframes bounce { from { transform: scale(1); } to { transform: scale(1.2); } }
.toast-text { font-size: 11px; margin-top: 2px; }

/* ===== Transitions ===== */
.pop-enter-active, .pop-leave-active { transition: all 0.2s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateX(-50%) translateY(5px); }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>
