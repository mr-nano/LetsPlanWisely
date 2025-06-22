<template>
  <div class="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
    <div
      ref="leftPanel"
      class="flex flex-col border-r border-gray-200 transition-width duration-100 ease-in-out"
      :style="{ width: leftPanelWidth }"
    >
      <div class="flex items-center justify-between mb-4 text-gray-700 p-4">
        <h2 class="text-xl font-semibold">Markdown Input</h2>
        </div>
      <TaskInputEditor
        ref="taskInputEditorRef"
        class="flex-grow min-h-0 px-4"
        @update:markdown="handleMarkdownUpdate"
      />
      <div class="mt-4 p-2 rounded mx-4 mb-4" :class="errorClass">
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

    <div
      class="w-2 h-full cursor-ew-resize bg-gray-300 hover:bg-blue-400 transition-colors duration-100 ease-in-out flex-shrink-0"
      style="min-width: 8px;"
      @mousedown="startResizing"
    ></div>

    <div
      ref="rightPanel"
      class="flex flex-col transition-width duration-100 ease-in-out"
      :style="{ width: rightPanelWidth }"
    >
      <div class="flex items-center justify-between mb-4 text-gray-700 p-4">
        <h2 class="text-xl font-semibold">Task Visualization</h2>
        </div>
      <TaskVisualizationCanvas
        ref="canvasRef"
        class="flex-grow min-h-0 mx-4 mb-4 bg-white border border-gray-200 rounded shadow-inner overflow-hidden"
        :scheduledTasks="scheduledTasks"
        :errors="errors"
      />
    </div>
    
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import TaskInputEditor from './components/TaskInputEditor.vue';
import TaskVisualizationCanvas from './components/TaskVisualizationCanvas.vue';
import { parseMarkdown } from './utils/parser.js';
import { scheduleTasks } from './utils/scheduler.js';

// --- REFS ---
const taskInputEditorRef = ref(null);
const canvasRef = ref(null);
const leftPanel = ref(null);
const rightPanel = ref(null);

// Panel resizing state
const initialLeftPanelWidth = parseFloat(localStorage.getItem('leftPanelWidth') || '50'); // Store as number
const leftPanelPercentage = ref(initialLeftPanelWidth);
const isResizing = ref(false);

// Removed fullscreen state (activeFullscreenPanel)

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

const leftPanelWidth = computed(() => `${leftPanelPercentage.value}%`);
const rightPanelWidth = computed(() => `${100 - leftPanelPercentage.value}%`);

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

  errors.value = currentErrors;
};

// --- Resizing Logic (Cleaned and Focused) ---
const startResizing = (e) => {
  console.log('Mousedown event triggered on divider');
  e.preventDefault(); // Prevent default drag behavior (e.g., image drag)
  isResizing.value = true;
  console.log('isResizing set to true');
  document.addEventListener('mousemove', resizePanels);
  document.addEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
};

const resizePanels = (e) => {
  if (!isResizing.value || !leftPanel.value || !rightPanel.value) return;

  const container = leftPanel.value.parentElement;
  if (!container) return; // Should not happen with flex container

  const containerRect = container.getBoundingClientRect();
  const containerWidth = containerRect.width;

  // Calculate new width for left panel based on mouse X position relative to container
  let newLeftWidthPx = e.clientX - containerRect.left;
  let newLeftPercentage = (newLeftWidthPx / containerWidth) * 100;

  // Constrain widths (e.g., min 10% for each panel)
  newLeftPercentage = Math.max(10, Math.min(90, newLeftPercentage));

  leftPanelPercentage.value = newLeftPercentage;
  localStorage.setItem('leftPanelWidth', newLeftPercentage.toFixed(2));
};

const stopResizing = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', resizePanels);
  document.removeEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'default';
  document.body.style.userSelect = 'auto';
};

// Removed all fullscreen related methods (toggleFullscreen, exitFullscreen, handleFullscreenChange)

// --- LIFECYCLE HOOKS ---
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

  // Removed fullscreen event listeners
});

onBeforeUnmount(() => {
  // Removed fullscreen event listeners cleanup
  // Ensure resize listeners are cleaned up if somehow still active
  document.removeEventListener('mousemove', resizePanels);
  document.removeEventListener('mouseup', stopResizing);
});


// --- WATCHERS ---
watch(() => parsedData.value.tasks, (newTasks) => {
  if (taskInputEditorRef.value) {
    const taskNames = newTasks.map(task => task.name).filter(name => typeof name === 'string' && name.length > 0);
    taskInputEditorRef.value.setAvailableTaskNames(taskNames);
  }
}, { immediate: true, deep: true });

watch(() => errors.value, (newErrors) => {
  if (taskInputEditorRef.value) {
    taskInputEditorRef.value.setLintDiagnostics(newErrors);
  }
}, { immediate: true, deep: true });

// No specific watchers for fullscreen or Konva redraw logic related to fullscreen
// The ResizeObserver in TaskVisualizationCanvas.vue should handle the Konva canvas resizing
// when its parent container (`rightPanel`) changes size due to `leftPanelPercentage` updates.
</script>

<style>
body {
  margin: 0;
  overflow: hidden;
}
.flex-grow-0 {
    flex-grow: 0;
}
.flex-shrink-0 {
    flex-shrink: 0;
}
.transition-width {
  transition: width 0.1s ease-in-out;
}
</style>