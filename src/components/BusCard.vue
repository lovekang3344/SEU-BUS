<template>
  <div class="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-5 mb-4 shadow-md transition-all duration-300 relative" :data-bus-key="busKey">
    <span class="float-right text-2xl font-bold text-primary">{{ bus.time }} 发车</span>
    <p class="text-xl my-1.5 mb-4 font-medium">
      将在 <strong class="text-accent-red text-2xl font-bold">{{ bus.waitTime }}</strong> 分钟后发车
    </p>
    
    <div class="clear-both pt-4 text-gray-600 dark:text-gray-300">
      <p class="text-base mb-3 font-medium">
        <span v-if="mode === 'destination'">上车地点: <strong>{{ bus.startLocation }}</strong></span>
        <span v-else>开往: <strong>{{ bus.destination }}</strong></span>
      </p>
      <p v-if="mode === 'destination'" class="text-base mb-3 font-medium">
        开往: <strong>{{ bus.destination }}</strong>
      </p>
      <div class="flex flex-wrap gap-2">
        <span 
          v-for="(note, index) in (bus.notes || [])" 
          :key="index"
          class="inline-block py-1 px-3 rounded-full text-sm font-semibold bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
          :class="{
            'bg-accent-orange text-white': note.includes('纪忠楼'),
            'bg-accent-green text-white': note.includes('大巴')
          }"
        >
          {{ note }}
        </span>
        <span v-if="!bus.notes || bus.notes.length === 0" class="italic text-gray-400 dark:text-gray-500 text-sm">
          无特殊备注
        </span>
      </div>
    </div>
    
    <div v-if="isAlarmSet && alarmCountdown > 0" class="mt-3 p-3 bg-primary-light dark:bg-gray-600 border border-primary dark:border-gray-500 rounded-lg">
      <p class="text-sm font-semibold text-primary dark:text-gray-200">
        📢 提醒倒计时: <span class="text-xl">{{ formatCountdown(alarmCountdown) }}</span>
      </p>
    </div>
    
    <div class="flex justify-start items-center mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-600">
      <button 
        class="py-2 px-3 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-500 rounded-lg cursor-pointer text-sm font-medium transition-colors mr-4 hover:bg-gray-200 dark:hover:bg-gray-500"
        :class="{ 'bg-accent-red text-white border-accent-red font-bold': isAlarmSet }"
        @click="handleToggleAlarmInput"
      >
        {{ isAlarmSet ? '已设提醒 (点击修改)' : '设置提醒' }}
      </button>
      
      <button 
        v-if="isAlarmSet"
        class="py-2 px-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer text-sm font-medium transition-colors hover:bg-red-200 dark:hover:bg-red-900/50"
        @click="handleCancelAlarm"
      >
        取消提醒
      </button>
      
      <div class="alarm-input-group flex items-center bg-white dark:bg-gray-700 py-1.5 text-base text-gray-600 dark:text-gray-300" style="display: none;">
        提前
        <input 
          type="number" 
          :value="alarmMinutes" 
          min="1" 
          max="15" 
          class="w-11 p-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-center mx-1.5 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-600"
          @input="alarmMinutes = $event.target.value"
        >
        分钟提醒
        <button 
          class="ml-2 py-1.5 px-2.5 border-none rounded-lg cursor-pointer bg-primary text-white transition-colors"
          @click="handleSetAlarm"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  bus: {
    type: Object,
    required: true
  },
  mode: {
    type: String,
    default: 'realtime'
  }
})

const emit = defineEmits(['set-alarm', 'toggle-alarm-input', 'cancel-alarm'])

const alarmMinutes = ref(5)
const alarmList = ref({})
const alarmCountdown = ref(0)
let countdownInterval = null

const busKey = computed(() => {
  return `${props.bus.startLocation}-${props.bus.time}-${props.bus.destination}`
})

const isAlarmSet = computed(() => {
  return alarmList.value.hasOwnProperty(busKey.value)
})

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function handleSetAlarm() {
  const minutes = parseInt(alarmMinutes.value, 10)
  emit('set-alarm', busKey.value, props.bus.time, props.bus.destination, props.bus.startLocation, minutes)
}

function handleToggleAlarmInput() {
  emit('toggle-alarm-input', busKey.value)
}

function handleCancelAlarm() {
  emit('cancel-alarm', busKey.value)
}

function startCountdown(seconds) {
  alarmCountdown.value = seconds
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
  countdownInterval = setInterval(() => {
    alarmCountdown.value--
    if (alarmCountdown.value <= 0) {
      clearInterval(countdownInterval)
      alarmCountdown.value = 0
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  alarmCountdown.value = 0
}

onUnmounted(() => {
  stopCountdown()
})

defineExpose({
  startCountdown,
  stopCountdown
})
</script>
