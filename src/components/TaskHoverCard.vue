<template>
    <div
      v-if="task"
      :style="cardStyle"
      class="absolute bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-50 pointer-events-none max-w-xs"
    >
      <div class="font-semibold text-gray-900 text-md mb-1 flex justify-between items-baseline">
        <span>{{ task.name }}</span>
        <span class="text-sm text-gray-500 ml-2">({{ task.duration }})</span>
      </div>
      <p class="text-gray-700 text-sm break-words">{{ task.description || 'No description provided.' }}</p>
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  
  const props = defineProps({
    task: {
      type: Object,
      default: null // The task object to display
    },
    mousePosition: {
      type: Object,
      default: () => ({ x: 0, y: 0 }) // Current mouse position {x, y}
    },
    containerRect: {
      type: Object,
      default: null // Bounding rectangle of the canvas container
    }
  });
  
  const cardStyle = computed(() => {
    if (!props.task) return {};
  
    const CARD_OFFSET = 10; // Offset the card from the cursor
    const CARD_APPROX_WIDTH = 250; // Approximate card width for boundary checks
    const CARD_APPROX_HEIGHT = 100; // Approximate card height for boundary checks
  
    let x = props.mousePosition.x + CARD_OFFSET;
    let y = props.mousePosition.y + CARD_OFFSET;
  
    // Basic boundary check to keep card within container
    if (props.containerRect) {
      if (x + CARD_APPROX_WIDTH > props.containerRect.width) {
        x = props.mousePosition.x - CARD_APPROX_WIDTH - CARD_OFFSET;
      }
      if (y + CARD_APPROX_HEIGHT > props.containerRect.height) {
        y = props.mousePosition.y - CARD_APPROX_HEIGHT - CARD_OFFSET;
      }
    }
  
    return {
      left: `${x}px`,
      top: `${y}px`,
    };
  });
  </script>
  
  <style scoped>
  /* No specific styles needed here as Tailwind handles them */
  </style>