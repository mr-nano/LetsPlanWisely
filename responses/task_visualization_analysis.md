# Task Visualization Analysis: Task Group Separation

## Overview

This document analyzes the current task visualization implementation and identifies the changes needed to ensure that tasks from different task groups are visualized in separate horizontal lanes.

## Current Architecture

### Visualization Component
- **File**: `src/components/TaskVisualizationCanvas.vue`
- **Purpose**: Renders scheduled tasks on a Konva.js canvas with lane-based layout
- **Key Algorithm**: `tasksWithLayout` computed property (lines 140-200)

### Current Lane Assignment Logic
The current algorithm in `tasksWithLayout`:

1. **Sorts tasks** by start time, then by end time
2. **Assigns lanes based on time conflicts** - tasks that don't overlap in time can share the same lane
3. **Does NOT consider task group membership** when assigning lanes

```javascript
// Current logic (simplified)
tasks.forEach(task => {
  let assignedLaneIndex = -1;
  
  // Try to find existing lane without time conflicts
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
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
  
  // Create new lane if needed
  if (assignedLaneIndex === -1) {
    assignedLaneIndex = lanes.length;
    lanes.push([]);
  }
  
  // Assign task to lane
  lanes[assignedLaneIndex].push(task);
});
```

## Task Group Data Flow

### 1. Parsing (`src/utils/parser.js`)
- Task groups are parsed from markdown input
- Stored in `parsedData.taskGroups`

### 2. Scheduling (`src/utils/scheduler.js`)
- Task groups are used to apply bandwidth constraints
- Each task gets an `assignedBandwidthGroup` property
- This property contains the task group object that applies to the task

### 3. Visualization (`src/components/TaskVisualizationCanvas.vue`)
- **Currently receives**: Only `scheduledTasks` (no task groups)
- **Missing**: Task group information needed for lane separation

## The Problem

Tasks from different task groups can end up in the same horizontal lane if they don't overlap in time, even though they should be visually separated to represent different teams/resource pools.

**Example Scenario**:
```
Task Group "Frontend Team" ["Task A", "Task B"] bandwidth: 2
Task Group "Backend Team" ["Task C", "Task D"] bandwidth: 1

Timeline:
Task A: 0-5
Task C: 6-10  (no overlap with Task A, so they could share a lane)
Task B: 11-15
Task D: 16-20 (no overlap with Task B, so they could share a lane)
```

**Current Result**: Tasks A and C might be in lane 0, Tasks B and D in lane 1
**Desired Result**: Tasks A and B in lane 0 (Frontend), Tasks C and D in lane 1 (Backend)

## Required Changes

### 1. Modify TaskVisualizationCanvas.vue Props

Add `taskGroups` as a prop to receive task group information:

```javascript
const props = defineProps({
  scheduledTasks: {
    type: Array,
    default: () => []
  },
  taskGroups: {  // NEW PROP
    type: Array,
    default: () => []
  },
  errors: {
    type: Array,
    default: () => []
  }
});
```

### 2. Modify Lane Assignment Algorithm

Update the `tasksWithLayout` computed property to:

1. **Group tasks by their assigned task group**
2. **Assign lanes independently within each group**
3. **Ensure no cross-group lane sharing**

```javascript
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
    const groupLanes = [];
    
    // Sort tasks within group by start time
    groupTasks.sort((a, b) => {
      if (a.startTime !== b.startTime) {
        return a.startTime - b.startTime;
      }
      return a.endTime - b.endTime;
    });

    // Assign lanes within this group
    groupTasks.forEach(task => {
      let assignedLaneIndex = -1;
      
      // Try to find existing lane in this group without time conflicts
      for (let i = 0; i < groupLanes.length; i++) {
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
      
      // Create new lane in this group if needed
      if (assignedLaneIndex === -1) {
        assignedLaneIndex = groupLanes.length;
        groupLanes.push([]);
      }
      
      // Add task to the assigned lane
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
    
    // Update global lane offset for next group
    globalLaneOffset += groupLanes.length;
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
```

### 3. Update App.vue

Pass task groups to the visualization component:

```vue
<TaskVisualizationCanvas
  ref="canvasRef"
  class="flex-grow min-h-0 mx-4 mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-inner dark:shadow-md overflow-hidden"
  :scheduledTasks="scheduledTasks"
  :taskGroups="parsedData.taskGroups"  <!-- NEW PROP -->
  :errors="errors"
/>
```

## Benefits of This Approach

1. **Visual Separation**: Tasks from different groups are clearly separated
2. **Maintains Efficiency**: Still uses optimal lane assignment within each group
3. **Backward Compatibility**: Ungrouped tasks still work with global bandwidth
4. **Extensible**: Easy to add visual indicators for different groups (colors, labels, etc.)

## Future Enhancements

1. **Visual Group Indicators**: Add group labels or different colors for each task group
2. **Group Collapse/Expand**: Allow users to collapse/expand task groups
3. **Group-Specific Styling**: Different visual styles for different task groups
4. **Group Statistics**: Show bandwidth utilization per group

## Implementation Priority

1. **High Priority**: Implement basic task group separation
2. **Medium Priority**: Add visual group indicators
3. **Low Priority**: Add interactive group features

This change ensures that the visualization accurately represents the resource allocation and team structure defined in the task groups, making it easier for users to understand which tasks belong to which teams or resource pools. 