<template>
  <div ref="canvasContainer" class="relative h-full w-full overflow-hidden flex items-center justify-center text-gray-500">
    <p>Visualization will appear here (Konva.js/PixiJS canvas)</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const canvasContainer = ref(null);
let stage = null; // Will hold Konva.Stage or Pixi.Application instance

// This component will receive scheduled task data from App.vue
const props = defineProps({
  scheduledTasks: { // Renamed prop to reflect scheduled data
    type: Array,
    default: () => []
  },
  errors: {
    type: Array,
    default: () => []
  }
});

onMounted(() => {
  console.log('Canvas container mounted:', canvasContainer.value);
  // Initial render based on initial props
  renderVisualization(props.scheduledTasks, props.errors);
});

onUnmounted(() => {
  // Cleanup Konva.js/PixiJS stage if it was initialized
  if (stage) {
    stage.destroy();
  }
});

// Function to handle rendering (will be filled with Konva/Pixi logic later)
const renderVisualization = (tasks, errs) => {
  console.log('Visualization received scheduled tasks:', tasks);
  console.log('Visualization received errors:', errs);
  // This is where your Konva.js/PixiJS rendering logic will go.
  // For now, it just logs.
};

// Watch for changes in scheduledTasks or errors to re-render the visualization
watch(() => props.scheduledTasks, (newTasks) => {
  renderVisualization(newTasks, props.errors);
}, { deep: true }); // Use deep watch for objects if task objects can change internally

watch(() => props.errors, (newErrors) => {
  renderVisualization(props.scheduledTasks, newErrors);
});
</script>