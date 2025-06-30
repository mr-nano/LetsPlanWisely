<template>
  <div ref="canvasContainer" class="relative h-full w-full overflow-hidden">
    <v-stage ref="stageRef" :config="stageConfig" @wheel="handleWheel">
      <v-layer ref="layerRef">
        <!-- Render group boxes behind tasks -->
        <template v-for="group in groupBoxes" :key="group.groupKey">
          <v-rect
            :config="group.boxConfig"
            :data-testid="`group-box-${group.groupKey}`"
          />
          <v-text
            :config="group.labelConfig"
          />
        </template>
        <template v-for="task in tasksWithLayout" :key="task.name">
          <v-rect :config="getTaskRectConfig(task)" />
          <v-text :config="getTaskTextConfig(task)" />
        </template>
      </v-layer>
    </v-stage>
    <TaskHoverCard
      :task="hoveredTask"
      :mouse-position="mousePosition"
      :container-rect="containerBoundingRect"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, defineExpose } from 'vue';
import TaskHoverCard from './TaskHoverCard.vue'; 

// No direct named imports for Stage, Layer, Rect, Line as they are globally registered by app.use(VueKonva)

// --- PROPS ---
const props = defineProps({
  scheduledTasks: {
    type: Array,
    default: () => []
  },
  taskGroups: {
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

const hoveredTask = ref(null); // Stores the task object currently hovered
const mousePosition = ref({ x: 0, y: 0 }); // Stores the current mouse position relative to canvasContainer
const containerBoundingRect = ref(null); // Stores the bounding rectangle of the canvasContainer div


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

// Add a vertical margin between groups
const GROUP_VERTICAL_MARGIN = 24;

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

const zoomToFit = () => {
  if (!stageRef.value || !canvasContainer.value || tasksWithLayout.value.length === 0) {
    return;
  }

  const stage = stageRef.value.getStage();
  const containerWidth = canvasContainer.value.offsetWidth;
  const containerHeight = canvasContainer.value.offsetHeight;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  tasksWithLayout.value.forEach(task => {
    minX = Math.min(minX, task.x);
    minY = Math.min(minY, task.y);
    maxX = Math.max(maxX, task.x + task.width);
    maxY = Math.max(maxY, task.y + task.height);
  });

  const PADDING = 40; 
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  const scaleX = containerWidth / contentWidth;
  const scaleY = containerHeight / contentHeight;
  const newScale = Math.min(scaleX, scaleY, 1.5); // Cap maximum zoom

  const centerX = minX + contentWidth / 2;
  const centerY = minY + contentHeight / 2;

  const newPosX = (containerWidth / 2) - (centerX * newScale);
  const newPosY = (containerHeight / 2) - (centerY * newScale);

  scale.value = newScale;
  position.value = { x: newPosX, y: newPosY };

  stage.batchDraw();

  hoveredTask.value = null;
};

/**
 * Advanced layout algorithm to assign tasks to lanes (Y positions)
 * to visualize parallel execution with task group separation.
 * @param {Array<Object>} scheduledTasks - Tasks with startTime, endTime, resolvedDuration, assignedBandwidthGroup.
 * @returns {Array<Object>} Tasks augmented with 'x', 'y', 'width', 'height', 'laneIndex', 'groupKey'.
 */
const tasksWithLayout = computed(() => {
  const tasks = [...props.scheduledTasks];
  if (tasks.length === 0) return [];

  // Group tasks by their assigned bandwidth group
  const taskGroups = new Map();
  const ungroupedTasks = [];
  
  tasks.forEach(task => {
    if (task.assignedBandwidthGroup) {
      const groupKey = task.assignedBandwidthGroup.name || 
                      (task.assignedBandwidthGroup.type === 'list' ? 
                       task.assignedBandwidthGroup.identifiers.join(',') : 
                       task.assignedBandwidthGroup.identifiers[0]);
      
      if (!taskGroups.has(groupKey)) {
        taskGroups.set(groupKey, []);
      }
      taskGroups.get(groupKey).push(task);
    } else {
      ungroupedTasks.push(task);
    }
  });

  // Assign lanes for each group independently
  const augmentedTasks = [];
  let globalLaneOffset = 0;

  // Process each task group
  taskGroups.forEach((groupTasks, groupKey) => {
    // Determine bandwidth for this group (default to 1 if missing)
    const groupBandwidth = groupTasks[0]?.assignedBandwidthGroup?.bandwidth || 1;
    const groupLanes = Array.from({ length: groupBandwidth }, () => []);

    // Sort tasks within group by start time
    groupTasks.sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime - b.startTime;
      }
      return a.endTime - b.endTime;
    });

    // Assign tasks to lanes, ensuring no more than 'bandwidth' overlap
    groupTasks.forEach(task => {
      let assignedLaneIndex = -1;
      // Try to find a lane without time conflict
      for (let i = 0; i < groupBandwidth; i++) {
        const lane = groupLanes[i];
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
      // If all lanes are in conflict, assign to the first lane (stack visually)
      if (assignedLaneIndex === -1) {
        assignedLaneIndex = 0;
      }
      groupLanes[assignedLaneIndex].push(task);

      // Calculate layout properties with global offset
      const x = START_OFFSET_X + task.startTime * TIME_UNIT_WIDTH;
      const y = START_OFFSET_Y + (globalLaneOffset + assignedLaneIndex) * (TASK_HEIGHT + TASK_VERTICAL_PADDING);
      const width = task.resolvedDuration * TIME_UNIT_WIDTH;
      const height = TASK_HEIGHT;

      augmentedTasks.push({
        ...task,
        x,
        y,
        width,
        height,
        laneIndex: globalLaneOffset + assignedLaneIndex,
        groupKey: groupKey,
      });
    });

    // Update global lane offset for next group, adding group margin
    globalLaneOffset += groupBandwidth;
    globalLaneOffset += GROUP_VERTICAL_MARGIN / (TASK_HEIGHT + TASK_VERTICAL_PADDING);
  });

  // Process ungrouped tasks (use global bandwidth)
  if (ungroupedTasks.length > 0) {
    const globalLanes = [];
    
    ungroupedTasks.sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime - b.startTime;
      }
      return a.endTime - b.endTime;
    });

    ungroupedTasks.forEach(task => {
      let assignedLaneIndex = -1;
      
      // Try to find existing global lane without time conflicts
      for (let i = 0; i < globalLanes.length; i++) {
        const lane = globalLanes[i];
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
      
      // Create new global lane if needed
      if (assignedLaneIndex === -1) {
        assignedLaneIndex = globalLanes.length;
        globalLanes.push([]);
      }
      
      // Add task to the assigned lane
      globalLanes[assignedLaneIndex].push(task);
      
      // Calculate layout properties
      const x = START_OFFSET_X + task.startTime * TIME_UNIT_WIDTH;
      const y = START_OFFSET_Y + (globalLaneOffset + assignedLaneIndex) * (TASK_HEIGHT + TASK_VERTICAL_PADDING);
      const width = task.resolvedDuration * TIME_UNIT_WIDTH;
      const height = TASK_HEIGHT;

      augmentedTasks.push({
        ...task,
        x,
        y,
        width,
        height,
        laneIndex: globalLaneOffset + assignedLaneIndex,
        groupKey: 'global',
      });
    });
  }

  return augmentedTasks;
});

// --- GROUP BOX COMPUTED ---
const groupBoxes = computed(() => {
  // Group tasks by groupKey
  const groups = {};
  tasksWithLayout.value.forEach(task => {
    if (task.groupKey && task.groupKey !== 'global') {
      if (!groups[task.groupKey]) groups[task.groupKey] = [];
      groups[task.groupKey].push(task);
    }
  });
  // For each group, compute bounding box
  return Object.entries(groups).map(([groupKey, tasks]) => {
    if (!tasks.length) return null;
    let minX = Math.min(...tasks.map(t => t.x));
    let minY = Math.min(...tasks.map(t => t.y));
    let maxX = Math.max(...tasks.map(t => t.x + t.width));
    let maxY = Math.max(...tasks.map(t => t.y + t.height));
    // Add some padding
    const PADDING = 10;
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;
    // Find group name
    const groupName = tasks[0]?.assignedBandwidthGroup?.name || groupKey;
    return {
      groupKey,
      boxConfig: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        fill: undefined, // transparent
        stroke: '#CBD5E1', // gray-300
        strokeWidth: 2,
        cornerRadius: 8,
        listening: false,
      },
      labelConfig: {
        x: minX + 8,
        y: minY - FONT_SIZE - 2,
        text: groupName,
        fontSize: FONT_SIZE,
        fontFamily: FONT_FAMILY,
        fill: '#64748b', // gray-500
        listening: false,
      }
    };
  }).filter(Boolean);
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
    onMouseenter: (e) => handleMouseEnter(e, task),
    onMouseleave: handleMouseLeave,
    onMousemove: handleMouseMove,
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
  // --- ADD THIS LINE: Hide hover card on zoom/pan ---
  hoveredTask.value = null; 
  // --- END ADD ---
};

// --- ADD THESE NEW FUNCTIONS ---

// Handle mouse entering a task rectangle
const handleMouseEnter = (e, task) => {
  hoveredTask.value = task;
  // Update mouse position immediately
  handleMouseMove(e); 
};

// Handle mouse leaving a task rectangle
const handleMouseLeave = () => {
  hoveredTask.value = null;
};

// Handle mouse movement (for precise hover card positioning)
const handleMouseMove = (e) => {
  if (hoveredTask.value && canvasContainer.value) {
    // Get the bounding rectangle of the canvas container once per hover, or on resize
    if (!containerBoundingRect.value) {
        containerBoundingRect.value = canvasContainer.value.getBoundingClientRect();
    }
    
    // Calculate mouse position relative to the canvas container's viewport
    mousePosition.value = {
      x: e.evt.clientX - containerBoundingRect.value.left,
      y: e.evt.clientY - containerBoundingRect.value.top,
    };
  }
};
// --- END NEW FUNCTIONS ---

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
      // Update container bounding rect on resize
      containerBoundingRect.value = canvasContainer.value.getBoundingClientRect();

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

defineExpose({
  zoomToFit,
  canvasContainer, // Expose for App.vue to access width/height
  stageRef // Expose for App.vue to access Konva stage methods
});
</script>

<style scoped>
/* No specific styles needed here as Konva handles drawing and Tailwind is for container */
</style>