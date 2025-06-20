<template>
  <div class="flex h-screen bg-gray-50 font-sans text-gray-800">
    <div class="w-1/2 p-4 border-r border-gray-200 flex flex-col">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">Markdown Input</h2>
      <TaskInputEditor class="flex-grow min-h-0" @update:markdown="handleMarkdownUpdate" />
      <div class="mt-4 p-2 rounded" :class="errorClass">
        <p v-if="errors.length === 0" class="text-green-800">No parsing errors or warnings.</p>
        <div v-else>
          <p class="font-semibold text-red-800">Parsing Issues:</p>
          <ul class="list-disc pl-5 text-sm">
            <li v-for="(error, index) in errors" :key="index" :class="error.type === 'error' ? 'text-red-700' : 'text-yellow-700'">
              {{ error.message }} <span v-if="error.line !== 'N/A'">(Line: {{ error.line }})</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="w-1/2 p-4 flex flex-col">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">Task Visualization</h2>
      <TaskVisualizationCanvas
        class="flex-grow min-h-0 bg-white border border-gray-200 rounded shadow-inner overflow-hidden"
        :parsedData="parsedData"
        :errors="errors"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import TaskInputEditor from './components/TaskInputEditor.vue';
import TaskVisualizationCanvas from './components/TaskVisualizationCanvas.vue';
import { parseMarkdown } from './utils/parser.js'; // Import our parser

// Reactive variable to hold the parsed data
const parsedData = ref({
  tasks: [],
  dependencies: [],
  durationLabels: {},
  globalBandwidth: 'unbound',
  taskGroups: [],
});

// Reactive variable to hold parsing errors
const errors = ref([]);

// Computed property for dynamic error message box styling
const errorClass = computed(() => {
  const hasErrors = errors.value.some(e => e.type === 'error');
  const hasWarnings = errors.value.some(e => e.type === 'warning');

  if (hasErrors) {
    return 'bg-red-100 border border-red-200 text-red-800';
  } else if (hasWarnings) {
    return 'bg-yellow-100 border border-yellow-200 text-yellow-800';
  } else {
    return 'bg-green-100 border border-green-200 text-green-800';
  }
});

// Handler for when the markdown input updates
const handleMarkdownUpdate = (markdown) => {
  const result = parseMarkdown(markdown);
  parsedData.value = {
    tasks: result.tasks,
    dependencies: result.dependencies,
    durationLabels: result.durationLabels,
    globalBandwidth: result.globalBandwidth,
    taskGroups: result.taskGroups,
  };
  errors.value = result.errors;

  console.log('Parsed Data:', parsedData.value);
  console.log('Errors:', errors.value);
};

// Initialize with a parse of the default content from TaskInputEditor
// This ensures the App component processes the initial markdown from TaskInputEditor
// immediately when App.vue is mounted.
onMounted(() => {
  // The default content from TaskInputEditor.vue
  const initialMarkdown = `Task "Develop UI" "Implement frontend" "M" "Code Backend"
Task "Code Backend" "Develop API and DB" "L"
Task "Write Docs" "Prepare user documentation" "S" "Develop UI"
Task "Deploy Backend" "Set up server infrastructure" "XL" "Code Backend"
Task "Test Integration" "Ensure systems work together" "M" "Develop UI, Deploy Backend"

Global Bandwidth: 2
L:10
M:5
S:2
XL:15
`;
  handleMarkdownUpdate(initialMarkdown);
});
</script>

<style>
/* You can add any global styles here, but Tailwind handles most of it */
body {
  margin: 0;
  overflow: hidden; /* Prevent body scroll if content fills viewport */
}
</style>