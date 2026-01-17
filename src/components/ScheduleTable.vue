<template>
  <div>
    <div v-if="Object.keys(schedules).length === 0" class="bg-primary-light dark:bg-gray-700 border border-primary dark:border-gray-600 text-primary-dark dark:text-gray-200 rounded-xl p-7.5 text-center text-base">
      时刻表数据加载中...
    </div>
    
    <div v-else>
      <div v-for="(buses, stop) in schedules" :key="stop" class="mb-6">
        <h3 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{{ stop }}</h3>
        <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-primary-light dark:bg-gray-700">
                <th class="py-2.5 px-2.5 border border-gray-200 dark:border-gray-600 text-left text-sm font-semibold text-primary-dark dark:text-gray-200 sticky top-0 z-10">时间</th>
                <th class="py-2.5 px-2.5 border border-gray-200 dark:border-gray-600 text-left text-sm font-semibold text-primary-dark dark:text-gray-200 sticky top-0 z-10">终点</th>
                <th class="py-2.5 px-2.5 border border-gray-200 dark:border-gray-600 text-left text-sm font-semibold text-primary-dark dark:text-gray-200 sticky top-0 z-10">备注</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(bus, index) in buses" 
                :key="index"
                class="even:bg-gray-50 dark:even:bg-gray-800"
              >
                <td class="py-2.5 px-2.5 border border-gray-200 dark:border-gray-600 text-sm font-semibold text-primary">{{ bus.time }}</td>
                <td class="py-2.5 px-2.5 border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200">{{ bus.destination }}</td>
                <td class="py-2.5 px-2.5 border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200">
                  <span 
                    v-for="(note, nIndex) in (bus.notes || [])" 
                    :key="nIndex"
                    class="inline-block py-0.5 px-2 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 mr-1"
                    :class="{
                      'bg-accent-orange text-white': note.includes('纪忠楼'),
                      'bg-accent-green text-white': note.includes('大巴')
                    }"
                  >
                    {{ note }}
                  </span>
                  <span v-if="!bus.notes || bus.notes.length === 0" class="text-gray-400 dark:text-gray-500">无</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  schedules: {
    type: Object,
    default: () => ({})
  }
})
</script>
