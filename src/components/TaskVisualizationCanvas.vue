<template>
  <div ref="canvasContainer" class="relative h-full w-full overflow-hidden flex items-center justify-center text-gray-500">
    <p>Visualization will appear here (Konva.js/PixiJS canvas)</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const canvasContainer = ref(null);
let stage = null; // Will hold Konva.Stage or Pixi.Application instance

// This component will receive parsed task data from App.vue
const props = defineProps({
  parsedData: { // New prop to receive all parsed data
    type: Object,
    default: () => ({
      tasks: [],
      dependencies: [],
      durationLabels: {},
      globalBandwidth: 'unbound',
      taskGroups: [],
    })
  },
  errors: {
    type: Array,
    default: () => []
  }
});

onMounted(() => {
  // Placeholder for Konva.js or PixiJS initialization
  console.log('Canvas container mounted:', canvasContainer.value);
  // Initial render based on initial props
  renderVisualization(props.parsedData, props.errors);
});

onUnmounted(() => {
  // Cleanup Konva.js/PixiJS stage if it was initialized
  if (stage) {
    stage.destroy();
  }
});

// Function to handle rendering (will be filled with Konva/Pixi logic later)
const renderVisualization = (data, errs) => {
  console.log('Visualization received parsed data:', data);
  console.log('Visualization received errors:', errs);
  // This is where your Konva.js/PixiJS rendering logic will go.
  // For now, it just logs.
};

// Watch for changes in parsedData or errors to re-render the visualization
watch(() => props.parsedData, (newData) => {
  renderVisualization(newData, props.errors);
}, { deep: true }); // Use deep watch for objects

watch(() => props.errors, (newErrors) => {
  renderVisualization(props.parsedData, newErrors);
});
</script>