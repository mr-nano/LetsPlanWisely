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
    <p class="text-gray-700 text-sm break-words mb-2">{{ task.description || 'No description provided.' }}</p>

    <div v-if="hasDetails" data-testid="task-details-section">
      <div v-for="(values, key) in task.details" :key="key" class="mt-2">
        <p class="font-semibold text-gray-800 text-sm mb-1">{{ key }}:</p>
        <ul class="list-disc list-inside text-gray-600 text-xs pl-2">
          <li v-for="(value, idx) in values" :key="idx" class="mb-0.5">{{ value }}</li>
          <li v-if="values.length === 0" class="text-gray-500 italic">No entries</li>
        </ul>
      </div>
    </div>
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

const CARD_OFFSET = 10;
const CARD_APPROX_WIDTH = 250;
// Adjust CARD_APPROX_HEIGHT, as it will now vary based on content
// A safer approach might be to let CSS handle height and only worry about width for collision
const CARD_APPROX_HEIGHT_MIN = 100; // Minimum height for a card without details
const CARD_APPROX_HEIGHT_PER_DETAIL_ITEM = 20; // Approx height for each detail key/value pair

const cardStyle = computed(() => {
  if (!props.task) return {};

  let effectiveCardHeight = CARD_APPROX_HEIGHT_MIN;
  if (props.task.details) {
    for (const key in props.task.details) {
      // Add height for the key itself and each bullet point
      effectiveCardHeight += CARD_APPROX_HEIGHT_PER_DETAIL_ITEM; // For the key line
      effectiveCardHeight += (props.task.details[key].length * CARD_APPROX_HEIGHT_PER_DETAIL_ITEM); // For bullet points
    }
  }
  // Ensure a reasonable max height, or let content overflow and scroll if needed
  // For simplicity here, we'll use a dynamic estimate for boundary checks

  let x = props.mousePosition.x + CARD_OFFSET;
  let y = props.mousePosition.y + CARD_OFFSET;

  if (props.containerRect) {
    if (x + CARD_APPROX_WIDTH > props.containerRect.width) {
      x = props.mousePosition.x - CARD_APPROX_WIDTH - CARD_OFFSET;
    }
    // Use the dynamically estimated height for Y boundary check
    if (y + effectiveCardHeight > props.containerRect.height) {
      y = props.mousePosition.y - effectiveCardHeight - CARD_OFFSET;
    }
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
  };
});

// New computed property to check if task has any details
const hasDetails = computed(() => {
  return props.task && props.task.details && Object.keys(props.task.details).length > 0;
});
</script>

<style scoped>
/* No specific styles needed here as Tailwind handles them */
/* Consider adding max-height and overflow-y: auto if details can become very long */
</style>