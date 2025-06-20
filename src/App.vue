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
        :scheduledTasks="scheduledTasks"
        :errors="errors"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import TaskInputEditor from './components/TaskInputEditor.vue';
import TaskVisualizationCanvas from './components/TaskVisualizationCanvas.vue';
import { parseMarkdown } from './utils/parser.js';
import { scheduleTasks } from './utils/scheduler.js'; // Import our new scheduler

// Reactive variable to hold the parsed data from markdown
const parsedData = ref({
  tasks: [],
  dependencies: [],
  durationLabels: {},
  globalBandwidth: 'unbound',
  taskGroups: [],
});

// Reactive variable to hold the final scheduled tasks (with start/end times)
const scheduledTasks = ref([]);

// Reactive variable to hold parsing and scheduling errors
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
  const parseResult = parseMarkdown(markdown);
  parsedData.value = {
    tasks: parseResult.tasks,
    dependencies: parseResult.dependencies,
    durationLabels: parseResult.durationLabels,
    globalBandwidth: parseResult.globalBandwidth,
    taskGroups: parseResult.taskGroups,
  };

  // Combine parser errors and potential scheduler errors
  const currentErrors = [...parseResult.errors]; // Start with parser errors

  if (parseResult.errors.filter(e => e.type === 'error').length > 0) {
      // If there are parsing errors, don't attempt to schedule
      scheduledTasks.value = [];
      errors.value = currentErrors;
      console.log('Skipping scheduling due to parsing errors.');
  } else {
      // Proceed to scheduling only if parsing was successful
      const scheduleResult = scheduleTasks(
          parsedData.value.tasks,
          parsedData.value.dependencies,
          parsedData.value.globalBandwidth,
          parsedData.value.taskGroups
      );

      scheduledTasks.value = scheduleResult.scheduledTasks;
      currentErrors.push(...scheduleResult.errors); // Add scheduler errors

      errors.value = currentErrors; // Update the errors ref for UI
  }

  console.log('Parsed Data:', parsedData.value);
  console.log('Scheduled Tasks:', scheduledTasks.value);
  console.log('All Errors:', errors.value);
};

// Trigger initial parse on component mount with default content
onMounted(() => {
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
body {
  margin: 0;
  overflow: hidden;
}
</style>