<template>
  <div class="flex h-screen bg-gray-50 font-sans text-gray-800">
    <div class="w-1/2 p-4 border-r border-gray-200 flex flex-col">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">Markdown Input</h2>
      <TaskInputEditor class="flex-grow min-h-0" />
      <div class="mt-4 p-2 bg-yellow-100 border border-yellow-200 text-sm text-yellow-800 rounded">
        Error/Warning Messages will appear here.
      </div>
    </div>

    <div class="w-1/2 p-4 flex flex-col">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">Task Visualization</h2>
      <TaskVisualizationCanvas class="flex-grow min-h-0 bg-white border border-gray-200 rounded shadow-inner overflow-hidden" />
    </div>
  </div>
</template>

<script setup>
import TaskInputEditor from './components/TaskInputEditor.vue';
import TaskVisualizationCanvas from './components/TaskVisualizationCanvas.vue';
</script>

<style>
/* You can add any global styles here, but Tailwind handles most of it */
body {
  margin: 0;
  overflow: hidden; /* Prevent body scroll if content fills viewport */
}
</style>