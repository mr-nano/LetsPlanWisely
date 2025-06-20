<template>
  <div class="flex h-screen bg-gray-50 font-sans text-gray-800">
    <div class="w-1/2 p-4 border-r border-gray-200 flex flex-col">
      <h2 class="text-xl font-semibold mb-4 text-gray-700">Markdown Input</h2>
      <TaskInputEditor
        ref="taskInputEditorRef"
        class="flex-grow min-h-0"
        @update:markdown="handleMarkdownUpdate"
      />
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
import { ref, computed, onMounted, watch } from 'vue';
import TaskInputEditor from './components/TaskInputEditor.vue';
import TaskVisualizationCanvas from './components/TaskVisualizationCanvas.vue';
import { parseMarkdown } from './utils/parser.js';
import { scheduleTasks } from './utils/scheduler.js';

// --- REFS ---
const taskInputEditorRef = ref(null); // Ref to TaskInputEditor component

const parsedData = ref({
  tasks: [],
  dependencies: [],
  durationLabels: {},
  globalBandwidth: 'unbound',
  taskGroups: [],
});

const scheduledTasks = ref([]);
const errors = ref([]);

// --- COMPUTED PROPERTIES ---
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

// --- METHODS ---
const handleMarkdownUpdate = (markdown) => {
  const parseResult = parseMarkdown(markdown);
  const parsedTasks = Array.isArray(parseResult.tasks) ? parseResult.tasks : [];

  parsedData.value = {
    tasks: parsedTasks,
    dependencies: parseResult.dependencies,
    durationLabels: parseResult.durationLabels,
    globalBandwidth: parseResult.globalBandwidth,
    taskGroups: parseResult.taskGroups,
  };

  const currentErrors = [...parseResult.errors];

  if (parseResult.errors.filter(e => e.type === 'error').length > 0) {
      scheduledTasks.value = [];
  } else {
      const scheduleResult = scheduleTasks(
          parsedData.value.tasks,
          parsedData.value.dependencies,
          parsedData.value.globalBandwidth,
          parsedData.value.taskGroups
      );

      scheduledTasks.value = scheduleResult.scheduledTasks;
      currentErrors.push(...scheduleResult.errors);
  }

  errors.value = currentErrors; // Update the errors ref for UI and editor linting
};


// --- LIFECYCLE HOOKS ---
onMounted(() => {
  // TaskInputEditor will now directly set its initial doc and emit 'update:markdown'.
  // This ensures the editor is the single source of truth for the document.
  // We remove the manual trigger here.
});


// --- WATCHERS ---
// Watch parsedData.tasks to send updated task names to the editor
watch(() => parsedData.value.tasks, (newTasks) => {
  if (taskInputEditorRef.value) {
    // THIS IS THE IMPORTANT CHANGE:
    // Ensure we only map to valid task names (strings) before sending to editor
    const taskNames = newTasks.map(task => task.name).filter(name => typeof name === 'string' && name.length > 0);
    taskInputEditorRef.value.setAvailableTaskNames(taskNames);
  }
}, { immediate: true, deep: true }); // immediate: true to send initial tasks

// Watch errors to send them to the editor for linting
watch(() => errors.value, (newErrors) => {
  if (taskInputEditorRef.value) {
    taskInputEditorRef.value.setLintDiagnostics(newErrors);
  }
}, { immediate: true, deep: true });
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
</style>