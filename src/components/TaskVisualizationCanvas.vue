<template>
  <div ref="canvasContainer" class="relative h-full w-full overflow-hidden">
    <v-stage ref="stageRef" :config="stageConfig" @wheel="handleWheel">
      <v-layer ref="layerRef">
        <v-rect
          v-for="task in scheduledTasks"
          :key="task.name"
          :config="getTaskRectConfig(task)"
        />
        </v-layer>
    </v-stage>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';


// --- PROPS ---
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

// --- REFS ---
const canvasContainer = ref(null);
const stageRef = ref(null); // Reference to the Konva Stage component
const layerRef = ref(null); // Reference to the Konva Layer component

const scale = ref(1); // For zoom
const position = ref({ x: 0, y: 0 }); // For pan

// --- CONFIGURATION CONSTANTS (Adjust these for aesthetics) ---
const TASK_HEIGHT = 40;
const TASK_GAP_Y = 15; // Gap between tasks in parallel lanes
const TASK_GAP_X = 5;  // Gap between sequential tasks
const TIME_UNIT_WIDTH = 20; // Pixels per abstract time unit
const START_OFFSET_X = 20; // Initial horizontal offset for the first task
const START_OFFSET_Y = 20; // Initial vertical offset for the first task

const TASK_FILL_COLOR = '#4299e1'; // Blue-500
const TASK_STROKE_COLOR = '#2b6cb0'; // Blue-700
const ERROR_FILL_COLOR = '#ef4444'; // Red-500
const ERROR_STROKE_COLOR = '#b91c1c'; // Red-700
const TEXT_COLOR = '#ffffff'; // White for task text

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
      draggable: true, // Enable panning by dragging
    };
  }
  return { width: 0, height: 0 }; // Default while not mounted
});

// Helper to determine if a task has an associated error
const hasError = (taskName) => {
  return props.errors.some(error =>
    error.type === 'error' &&
    (error.message.includes(`"${taskName}"`) || error.message.includes(`"${taskName}"`)) // Basic check
  );
};

// Returns the Konva.Rect configuration for a given task
const getTaskRectConfig = (task) => {
  const isErrorTask = hasError(task.name);
  const fillColor = isErrorTask ? ERROR_FILL_COLOR : TASK_FILL_COLOR;
  const strokeColor = isErrorTask ? ERROR_STROKE_COLOR : TASK_STROKE_COLOR;

  // Calculate X and Y position based on scheduled times and layout logic
  // For simplicity, let's just place tasks based on startTime for now,
  // and use a simple vertical stacking for tasks that run in parallel.
  // A more sophisticated layout algorithm will be needed for true parallelization visualization.

  // Simple layout: Group tasks by their start time for vertical placement.
  // This is a temporary simple layout. A more complex 'laning' algorithm will be needed later.
  let row = 0;
  let maxTime = 0;
  if (props.scheduledTasks && props.scheduledTasks.length > 0) {
      maxTime = Math.max(...props.scheduledTasks.map(t => t.endTime));
  }
  const maxRows = Math.floor(canvasContainer.value.offsetHeight / (TASK_HEIGHT + TASK_GAP_Y));

  // A very basic "lane" assignment for MVP:
  // This will try to fit tasks into rows based on conflicts, but it's not perfect
  // and will require a dedicated layout algorithm for proper "lanes"
  const lanes = []; // Array of arrays, each inner array represents tasks in a lane

  const findLane = (startTime, endTime) => {
      for (let i = 0; i < lanes.length; i++) {
          let conflict = false;
          for (const existingTask of lanes[i]) {
              // Check for overlap: [start1, end1) overlaps [start2, end2) if start1 < end2 AND end1 > start2
              if (!(endTime <= existingTask.startTime || startTime >= existingTask.endTime)) {
                  conflict = true;
                  break;
              }
          }
          if (!conflict) {
              return i;
          }
      }
      // If no suitable lane found, create a new one
      lanes.push([]);
      return lanes.length - 1;
  };

  // Re-sort tasks by start time to help with layout consistency
  const sortedTasks = [...props.scheduledTasks].sort((a, b) => a.startTime - b.startTime);

  // Assign tasks to lanes. This needs to be outside getTaskRectConfig to be stateful across tasks.
  // For now, let's keep it simple within this function's scope but acknowledge it's a temp solution.
  // We'll pass in pre-computed layout positions later.
  // For the MVP, let's just use a simple vertical stack for parallel tasks
  // (though the schedule data *does* reflect parallelism).

  // A more robust layout algorithm will assign Y positions (lanes) properly.
  // For now, let's make a very simplistic 'batch' based row assignment for visual distinction.
  // This is NOT a proper critical path layout, but shows tasks.
  let currentY = START_OFFSET_Y;
  let previousEndTime = 0;
  let currentRowTasks = [];
  const taskLayoutMap = new Map(); // Store {taskName: {x, y}}


  // A very basic layout strategy:
  // If tasks can run at the same time, place them in new "rows" (y position).
  // This will require a more complex algorithm for optimal vertical packing.
  // For now, let's just use start time and a simple vertical counter for same-start-time tasks.
  // This is still going to be very basic visually, but will show duration.

  // To truly visualize parallelization correctly, we need to assign 'lanes'.
  // This is a placeholder for a more advanced layout algorithm.
  // Let's aim for a 'swimlane' effect where tasks are explicitly placed into horizontal bands.

  // For initial MVP, let's just sort by start time and assign Y based on index,
  // This will make tasks with the same start time stack vertically.
  // This is not the "optimal" parallel visualization but a starting point.
  const taskOrderForLayout = [...props.scheduledTasks].sort((a, b) => a.startTime - b.startTime);
  const taskYPositions = new Map(); // Maps startTime to next available Y position for that batch
  const laneHeights = new Map(); // Maps lane index to current height
  let globalMaxY = START_OFFSET_Y;

  // A simple grid-like layout where tasks starting at the same time try to fill a row.
  // This will produce more of a 'waterfall' effect rather than distinct lanes.
  let yOffset = START_OFFSET_Y;
  const timeSliceOccupancy = {}; // timeUnit: {lane: occupiedByTaskName}

  // To truly visualize parallelism and ensure tasks don't overlap vertically unless they are independent.
  // We need a layout algorithm that assigns 'lanes' (Y positions) to tasks.

  // Temporarily, let's just make sure they appear at all, and don't overlap horizontally.
  // A simple strategy: sort by start time. Assign Y position for parallel tasks to avoid horizontal overlap.
  // This is just a visual grouping, not a true Gantt chart lane assignment yet.
  const taskLaneMap = new Map(); // taskName -> assignedLaneIndex
  const laneEndTimes = []; // laneIndex -> latestEndTimeInLane

  // Sort by start time, then duration (longer first to fit better)
  const tasksForLayout = [...props.scheduledTasks].sort((a, b) => {
      if (a.startTime !== b.startTime) {
          return a.startTime - b.startTime;
      }
      return b.resolvedDuration - a.resolvedDuration;
  });

  tasksForLayout.forEach(t => {
      let assignedLane = -1;
      for (let i = 0; i < laneEndTimes.length; i++) {
          if (laneEndTimes[i] <= t.startTime) {
              assignedLane = i;
              break;
          }
      }
      if (assignedLane === -1) {
          // No available lane, create a new one
          assignedLane = laneEndTimes.length;
          laneEndTimes.push(t.endTime); // Initialize with this task's end time
      } else {
          laneEndTimes[assignedLane] = Math.max(laneEndTimes[assignedLane], t.endTime);
      }
      taskLaneMap.set(t.name, assignedLane);
  });

  const laneIndex = taskLaneMap.get(task.name) || 0; // Default to lane 0 if not mapped
  const x = START_OFFSET_X + task.startTime * TIME_UNIT_WIDTH;
  const y = START_OFFSET_Y + laneIndex * (TASK_HEIGHT + TASK_GAP_Y);
  const width = task.resolvedDuration * TIME_UNIT_WIDTH;
  const height = TASK_HEIGHT;

  return {
    x: x,
    y: y,
    width: width,
    height: height,
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth: 2,
    cornerRadius: 5,
    name: `task-rect-${task.name}`, // Unique name for potential interaction
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

  const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1; // Zoom out/in
  scale.value = newScale;

  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  position.value = newPos;
};


// --- WATCHERS ---
watch(
  () => props.scheduledTasks,
  (newTasks) => {
    // This re-renders the rectangles when scheduledTasks changes
    // VueKonva's reactivity handles updating the VNodes automatically
    console.log('Scheduled tasks updated, Konva will re-render.');
  },
  { deep: true, immediate: true }
);

watch(
  () => props.errors,
  (newErrors) => {
    // This will trigger re-rendering of tasks to apply error styling
    console.log('Errors updated, Konva will re-render task styling.');
  },
  { deep: true, immediate: true }
);

// Watch container size changes for responsive canvas resizing
onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    if (stageRef.value && canvasContainer.value) {
      stageRef.value.getStage().width(canvasContainer.value.offsetWidth);
      stageRef.value.getStage().height(canvasContainer.value.offsetHeight);
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