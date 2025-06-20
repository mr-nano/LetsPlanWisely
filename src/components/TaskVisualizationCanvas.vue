<template>
  <div ref="canvasContainer" class="relative h-full w-full overflow-hidden">
    <v-stage ref="stageRef" :config="stageConfig" @wheel="handleWheel">
      <v-layer ref="layerRef">
        <template v-for="task in tasksWithLayout" :key="task.name">
          <v-rect :config="getTaskRectConfig(task)" />
          <v-text :config="getTaskTextConfig(task)" />
        </template>
        </v-layer>
    </v-stage>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
// No direct named imports for Stage, Layer, Rect, Line as they are globally registered by app.use(VueKonva)

// --- PROPS ---
const props = defineProps({
  scheduledTasks: {
    type: Array,
    default: () => []
  },
  errors: {
    type: Array,
    default: () => []
  }
});

// --- REFS ---
const canvasContainer = ref(null);
const stageRef = ref(null);
const layerRef = ref(null);

const scale = ref(1); // For zoom
const position = ref({ x: 0, y: 0 }); // For pan

// --- CONFIGURATION CONSTANTS (Adjust these for aesthetics) ---
const TASK_HEIGHT = 40;
const TASK_VERTICAL_PADDING = 15; // Vertical space between task lanes
const TIME_UNIT_WIDTH = 20; // Pixels per abstract time unit (e.g., 20px per unit of duration)
const START_OFFSET_X = 20; // Initial horizontal offset for the first task
const START_OFFSET_Y = 20; // Initial vertical offset for the first task
const TEXT_PADDING_X = 8; // Horizontal padding for text inside task box
const FONT_SIZE = 12; // Base font size for task text

const TASK_FILL_COLOR = '#4299e1'; // Blue-500
const TASK_STROKE_COLOR = '#2b6cb0'; // Blue-700
const ERROR_FILL_COLOR = '#ef4444'; // Red-500
const ERROR_STROKE_COLOR = '#b91c1c'; // Red-700
const TEXT_COLOR = '#ffffff'; // White for task text
const FONT_FAMILY = 'Arial, sans-serif'; // Use a common sans-serif font

// --- COMPUTED PROPERTIES ---

// Stage configuration (width and height based on container)
const stageConfig = computed(() => {
  if (canvasContainer.value) {
    return {
      width: canvasContainer.value.offsetWidth,
      height: canvasContainer.value.offsetHeight,
      scaleX: scale.value,
      scaleY: scale.value,
      x: position.value.x,
      y: position.value.y,
      draggable: true,
    };
  }
  return { width: 0, height: 0 };
});

// Helper to determine if a task has an associated error
const hasError = (taskName) => {
  return props.errors.some(error =>
    error.type === 'error' &&
    (error.message.includes(`"${taskName}"`) || error.message.includes(`"${taskName}"`)) // Basic check for task name in error message
  );
};

/**
 * Advanced layout algorithm to assign tasks to lanes (Y positions)
 * to visualize parallel execution.
 * @param {Array<Object>} scheduledTasks - Tasks with startTime, endTime, resolvedDuration.
 * @returns {Array<Object>} Tasks augmented with 'x', 'y', 'width', 'height', 'laneIndex'.
 */
const tasksWithLayout = computed(() => {
  const tasks = [...props.scheduledTasks];
  if (tasks.length === 0) return [];

  // Sort tasks primarily by start time, then by end time (shorter ones first, to fill gaps)
  // This sort helps the lane assignment algorithm find better fits.
  tasks.sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime - b.startTime;
    }
    return a.endTime - b.endTime;
  });

  const lanes = []; // Each lane is an array of tasks assigned to it, sorted by start time
  const augmentedTasks = [];

  tasks.forEach(task => {
    let assignedLaneIndex = -1;

    // Try to find an existing lane where this task can fit
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      // Check if this task conflicts with any task currently in this lane
      // A conflict exists if (task.start < existing.end AND task.end > existing.start)
      let conflict = false;
      for (const existingTaskInLane of lane) {
        if (!(task.endTime <= existingTaskInLane.startTime || task.startTime >= existingTaskInLane.endTime)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        assignedLaneIndex = i;
        break;
      }
    }

    // If no suitable lane found, create a new one
    if (assignedLaneIndex === -1) {
      assignedLaneIndex = lanes.length;
      lanes.push([]);
    }

    // Add task to the assigned lane, keeping it sorted by start time
    // This is important for subsequent tasks checking for conflicts in this lane
    const insertIndex = lanes[assignedLaneIndex].findIndex(t => t.startTime > task.startTime);
    if (insertIndex === -1) {
      lanes[assignedLaneIndex].push(task);
    } else {
      lanes[assignedLaneIndex].splice(insertIndex, 0, task);
    }


    // Calculate layout properties
    const x = START_OFFSET_X + task.startTime * TIME_UNIT_WIDTH;
    const y = START_OFFSET_Y + assignedLaneIndex * (TASK_HEIGHT + TASK_VERTICAL_PADDING);
    const width = task.resolvedDuration * TIME_UNIT_WIDTH;
    const height = TASK_HEIGHT;

    augmentedTasks.push({
      ...task,
      x,
      y,
      width,
      height,
      laneIndex: assignedLaneIndex,
    });
  });

  return augmentedTasks;
});


// Returns the Konva.Rect configuration for a given task (now with pre-calculated layout)
const getTaskRectConfig = (task) => {
  const isErrorTask = hasError(task.name);
  const fillColor = isErrorTask ? ERROR_FILL_COLOR : TASK_FILL_COLOR;
  const strokeColor = isErrorTask ? ERROR_STROKE_COLOR : TASK_STROKE_COLOR;

  return {
    x: task.x,
    y: task.y,
    width: task.width,
    height: task.height,
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth: 2,
    cornerRadius: 5,
    name: `task-rect-${task.name}`, // Unique name for potential interaction
  };
};

// Returns the Konva.Text configuration for a given task
const getTaskTextConfig = (task) => {
  const primaryText = task.name;
  let secondaryText = '';

  // Determine effective description to display, prioritizing description over duration label
  if (task.description) {
    secondaryText = task.description;
  } else if (task.duration) {
    secondaryText = `(${task.duration})`;
  }

  // Combine texts
  let combinedText = primaryText;
  if (secondaryText) {
    combinedText += `\n(${secondaryText})`; // New line for secondary info
  }


  // Measure text width using Konva's dummy canvas for more accurate truncation
  // (This is a simplified approach, a more robust one might require a dummy Konva.Text node)
  // For now, let's use a heuristic based on font size and character count.
  const maxTextWidth = task.width - TEXT_PADDING_X * 2;
  const avgCharWidth = FONT_SIZE * 0.6; // Heuristic: average character is 0.6 times font size

  // Truncate logic for combined text to fit within two lines (if it becomes two lines)
  // and within the available width. This is a bit complex for a simple heuristic.
  // Konva.Text has 'width' and 'wrap' properties that help.
  // We'll rely on Konva's built-in wrapping here and ensure the container is wide enough.

  return {
    x: task.x + TEXT_PADDING_X,
    y: task.y + TASK_HEIGHT / 2 - (combinedText.split('\n').length * FONT_SIZE / 2), // Center vertically based on line count
    text: combinedText,
    fontSize: FONT_SIZE,
    fontFamily: FONT_FAMILY,
    fill: TEXT_COLOR,
    width: maxTextWidth, // Constrain text width to within task box padding
    height: TASK_HEIGHT, // Allow text to take full height of task box
    align: 'center', // Center text horizontally within its constrained width
    verticalAlign: 'middle', // Vertically align within its height
    name: `task-text-${task.name}`,
    listening: false, // Text does not need to respond to events, rect handles it
    ellipsis: true, // Add ellipsis if text overflows Konva.Text node width
    wrap: 'word', // Wrap text by word
  };
};


// --- EVENTS ---

// Handle wheel for zooming
const handleWheel = (e) => {
  e.evt.preventDefault(); // Prevent page scroll
  const stage = stageRef.value.getStage();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();

  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };

  // Zoom logic: deltaY > 0 means wheel down (zoom out), deltaY < 0 means wheel up (zoom in)
  const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1; // Zoom out/in by 10%
  scale.value = newScale;

  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  position.value = newPos;

  // Recalculate stage dimensions after zoom to adjust drawing area
  if (canvasContainer.value && stageRef.value) {
    // These lines are for adjusting the Konva virtual canvas size based on content scaling
    // It's more about preventing scrollbars or clipped content if the internal Konva world
    // becomes too small or too large relative to its viewport.
    // However, for basic zoom/pan, the stage's scale and position properties are usually enough.
    // Let's remove this complexity for now and see if it behaves better.
    // stageRef.value.getStage().width(canvasContainer.value.offsetWidth / newScale);
    // stageRef.value.getStage().height(canvasContainer.value.offsetHeight / newScale);
  }
};


// --- WATCHERS ---
watch(
  tasksWithLayout, // Watch the computed property that includes layout
  (newTasks) => {
    // console.log('Scheduled tasks updated, Konva will re-render with new layout.');
    // No manual draw call needed, VueKonva handles reactivity
  },
  { deep: true, immediate: true }
);

watch(
  () => props.errors,
  (newErrors) => {
    // console.log('Errors updated, Konva will re-render task styling.');
    // No manual draw call needed, VueKonva handles reactivity
  },
  { deep: true, immediate: true }
);

// Watch container size changes for responsive canvas resizing
onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    if (stageRef.value && canvasContainer.value) {
      // Set Konva stage width/height to fill container, then scale it
      stageRef.value.getStage().width(canvasContainer.value.offsetWidth);
      stageRef.value.getStage().height(canvasContainer.value.offsetHeight);
      // Reapply current scale and position to maintain view
      stageRef.value.getStage().scale({ x: scale.value, y: scale.value });
      stageRef.value.getStage().position({ x: position.value.x, y: position.value.y });
      stageRef.value.getStage().batchDraw(); // Optimize redrawing
    }
  });
  resizeObserver.observe(canvasContainer.value);
  onUnmounted(() => resizeObserver.disconnect());
});
</script>

<style scoped>
/* No specific styles needed here as Konva handles drawing and Tailwind is for container */
</style>