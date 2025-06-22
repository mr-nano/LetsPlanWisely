<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 overflow-hidden">
    <div
      ref="leftPanel"
      class="flex flex-col border-r border-gray-200 dark:border-gray-700 transition-width duration-100 ease-in-out"
      :style="{ width: leftPanelWidth }"
      :class="{
        'absolute inset-0 w-full h-full z-40': activeFullscreenPanel === 'left',
        'hidden': activeFullscreenPanel === 'right',
        'flex-grow': activeFullscreenPanel === null // Only flex-grow in split mode
      }"
    >
      <div class="flex items-center justify-between mb-4 text-gray-700 dark:text-gray-300 p-4">
        <h2 class="text-xl font-semibold">Markdown Input</h2>
        <div class="flex items-center">
          <button
            @click="toggleWordWrap"
            class="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-200 dark:hover:bg-gray-700 mr-2"
            :title="isWordWrappingEnabled ? 'Disable Word Wrap' : 'Enable Word Wrap'"
          >
            <span v-if="isWordWrappingEnabled">↔</span> <span v-else>⟷</span>
          </button>
          <button
            @click="toggleFullscreen('left')"
            class="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            :title="activeFullscreenPanel === 'left' ? 'Exit Fullscreen (Esc)' : 'Toggle Fullscreen Editor (F11)'"
          >
            <span v-if="activeFullscreenPanel !== 'left'">⛶</span>
            <span v-else>✕</span>
          </button>
        </div>
      </div>
      <TaskInputEditor
        ref="taskInputEditorRef"
        class="flex-grow min-h-0 px-4"
        @update:markdown="handleMarkdownUpdate"
      />
      <div
        class="mt-4 p-2 rounded mx-4 mb-4"
        :class="[
          errorClass, // This provides the base (light mode) classes
          // Now add dark mode overrides for error/warning states
          {
            'dark:bg-green-800 dark:border-green-700 dark:text-green-100': errors.length === 0, // No errors/warnings
            'dark:bg-red-800 dark:border-red-700 dark:text-red-100': errors.some(e => e.type === 'error'), // Has errors
            'dark:bg-yellow-800 dark:border-yellow-700 dark:text-yellow-100': errors.some(e => e.type === 'warning') && !errors.some(e => e.type === 'error') // Has warnings only
          }
        ]"
      >
        <p v-if="errors.length === 0" class="text-green-800 dark:text-green-200">No parsing errors or warnings.</p>
        <div v-else>
          <p class="font-semibold text-red-800 dark:text-red-200">Parsing Issues:</p>
          <ul class="list-disc pl-5 text-sm">
            <li v-for="(error, index) in errors" :key="index"
              :class="error.type === 'error' ? 'text-red-700 dark:text-red-100' : 'text-yellow-700 dark:text-yellow-100'">
              {{ error.message }} <span v-if="error.line !== 'N/A'">(Line: {{ error.line }})</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div
      v-if="activeFullscreenPanel === null"
      class="w-2 h-full cursor-ew-resize bg-gray-300 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors duration-100 ease-in-out flex-shrink-0"
      style="min-width: 8px;"
      @mousedown="startResizing"
    ></div>

    <div
      ref="rightPanel"
      class="flex flex-col transition-width duration-100 ease-in-out"
      :style="{ width: rightPanelWidth }"
      :class="{
        'absolute inset-0 w-full h-full z-40': activeFullscreenPanel === 'right',
        'hidden': activeFullscreenPanel === 'left',
        'flex-grow': activeFullscreenPanel === null // Only flex-grow in split mode
      }"
    >
      <div class="flex items-center justify-between mb-4 text-gray-700 dark:text-gray-300 p-4">
        <h2 class="text-xl font-semibold">Task Visualization</h2>
        <div class="flex items-center">
          <button
            @click="toggleDarkMode"
            class="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-200 dark:hover:bg-gray-700 mr-2"
            :title="isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode'"
          >
            <span v-if="isDarkMode">☀️</span> <span v-else>🌒</span>
          </button>
          <button
            @click="zoomToFitCanvas"
            class="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-200 dark:hover:bg-gray-700 mr-2"
            title="Zoom to Fit"
          >
            <span class="transform scale-x-[-1]">&#x21F2;</span>
          </button>
          <button
            @click="toggleFullscreen('right')"
            class="w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            :title="activeFullscreenPanel === 'right' ? 'Exit Fullscreen (Esc)' : 'Toggle Fullscreen Visualization (F11)'"
          >
            <span v-if="activeFullscreenPanel !== 'right'">⛶</span>
            <span v-else>✕</span>
          </button>
        </div>
      </div>
      <TaskVisualizationCanvas
        ref="canvasRef"
        class="flex-grow min-h-0 mx-4 mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-inner dark:shadow-md overflow-hidden"
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
const isWordWrappingEnabled = ref(false);
const isDarkMode = ref(false); // <--- Make sure this ref is present!

// Panel resizing state
const initialLeftPanelWidth = parseFloat(localStorage.getItem('leftPanelWidth') || '50');
const leftPanelPercentage = ref(initialLeftPanelWidth);
const isResizing = ref(false);

// Fullscreen state (CSS-driven, not browser API)
const activeFullscreenPanel = ref(null);

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

  // These classes define the default (light mode) appearance
  if (hasErrors) {
    return 'bg-red-100 border border-red-200 text-red-800';
  } else if (hasWarnings) {
    return 'bg-yellow-100 border border-yellow-200 text-yellow-800';
  } else {
    return 'bg-green-100 border border-green-200 text-green-800';
  }
});

const leftPanelWidth = computed(() => {
  if (activeFullscreenPanel.value === 'left') return '100%';
  if (activeFullscreenPanel.value === 'right') return '0px';
  return `${leftPanelPercentage.value}%`;
});

const rightPanelWidth = computed(() => {
  if (activeFullscreenPanel.value === 'right') return '100%';
  if (activeFullscreenPanel.value === 'left') return '0px';
  return `${100 - leftPanelPercentage.value}%`;
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

  errors.value = currentErrors;
};

// --- Make sure this method is present ---
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
};

const toggleWordWrap = () => {
  isWordWrappingEnabled.value = !isWordWrappingEnabled.value;
  if (taskInputEditorRef.value) {
    taskInputEditorRef.value.setWordWrapping(isWordWrappingEnabled.value);
  }
};

// --- Resizing Logic ---
const startResizing = (e) => {
  if (activeFullscreenPanel.value !== null) return;
  e.preventDefault();
  isResizing.value = true;
  document.addEventListener('mousemove', resizePanels);
  document.addEventListener('mouseup', stopResizing);
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
};

const resizePanels = (e) => {
  if (!isResizing.value || !leftPanel.value || !rightPanel.value) return;
  const container = leftPanel.value.parentElement;
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  const containerWidth = containerRect.width;
  let newLeftWidthPx = e.clientX - containerRect.left;
  let newLeftPercentage = (newLeftWidthPx / containerWidth) * 100;
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

const zoomToFitCanvas = () => {
  if (canvasRef.value && canvasRef.value.zoomToFit) {
    canvasRef.value.zoomToFit();
  }
};

// --- Fullscreen Logic ---
const toggleFullscreen = (panel) => {
  if (activeFullscreenPanel.value === panel) {
    activeFullscreenPanel.value = null;
  } else {
    activeFullscreenPanel.value = panel;
  }
  setTimeout(() => {
    if (canvasRef.value && canvasRef.value.canvasContainer && canvasRef.value.canvasContainer.value && canvasRef.value.stageRef) {
      const stage = canvasRef.value.stageRef.getStage();
      if (stage) {
        stage.width(canvasRef.value.canvasContainer.value.offsetWidth);
        stage.height(canvasRef.value.canvasContainer.value.offsetHeight);
        stage.batchDraw();
        stage.scaleX(1);
        stage.scaleY(1);
        stage.x(0);
        stage.y(0);
        stage.draw();
      }
    }
    if (taskInputEditorRef.value && taskInputEditorRef.value.view) {
      taskInputEditorRef.value.view.requestMeasure();
    }
  }, 100);
};

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

  // --- Make sure this initialization logic is present ---
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDarkMode.value = savedTheme === 'dark';
  } else {
    isDarkMode.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  // --- End of initialization logic ---
});

onBeforeUnmount(() => {
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

watch([leftPanelPercentage, activeFullscreenPanel], () => {
  setTimeout(() => {
    if (canvasRef.value && canvasRef.value.canvasContainer && canvasRef.value.canvasContainer.value && canvasRef.value.stageRef) {
      const stage = canvasRef.value.stageRef.getStage();
      if (stage) {
        stage.width(canvasRef.value.canvasContainer.value.offsetWidth);
        stage.height(canvasRef.value.canvasContainer.value.offsetHeight);
        stage.batchDraw();
      }
    }
    if (taskInputEditorRef.value && taskInputEditorRef.value.view) {
      taskInputEditorRef.value.view.requestMeasure();
    }
  }, 50);
});
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