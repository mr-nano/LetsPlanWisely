// Mock ResizeObserver for test environment
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// test/TaskVisualizationCanvas.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskVisualizationCanvas from '../src/components/TaskVisualizationCanvas.vue';

// Mock VueKonva components since they're globally registered
const mockVueKonva = {
  vStage: {
    template: '<div data-testid="v-stage"><slot /></div>',
    props: ['config'],
    emits: ['wheel']
  },
  vLayer: {
    template: '<div data-testid="v-layer"><slot /></div>'
  },
  vRect: {
    template: '<div data-testid="v-rect"></div>',
    props: ['config']
  },
  vText: {
    template: '<div data-testid="v-text"></div>',
    props: ['config']
  }
};

// Mock TaskHoverCard component
const mockTaskHoverCard = {
  template: '<div data-testid="task-hover-card"></div>',
  props: ['task', 'mousePosition', 'containerRect']
};

describe('TaskVisualizationCanvas - Lane Assignment', () => {
  let wrapper;

  // Helper function to create scheduled task objects
  const createScheduledTask = (name, startTime, endTime, duration, assignedBandwidthGroup = null) => ({
    name,
    description: `Description for ${name}`,
    duration: 'M',
    resolvedDuration: duration,
    startTime,
    endTime,
    assignedBandwidthGroup
  });

  // Helper function to create task group objects
  const createTaskGroup = (name, type, identifiers, bandwidth) => ({
    name,
    type,
    identifiers,
    bandwidth
  });

  beforeEach(() => {
    // Reset wrapper before each test
    wrapper = null;
  });

  describe('Basic Lane Assignment (No Task Groups)', () => {
    it('should assign tasks to lanes based on time conflicts only', async () => {
      const scheduledTasks = [
        createScheduledTask('Task A', 0, 5, 5),
        createScheduledTask('Task B', 6, 10, 4), // No overlap with Task A
        createScheduledTask('Task C', 2, 8, 6),  // Overlaps with both A and B
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      // Wait for computed properties to update
      await wrapper.vm.$nextTick();

      // Get the computed tasksWithLayout
      const tasksWithLayout = wrapper.vm.tasksWithLayout;

      expect(tasksWithLayout).toHaveLength(3);

      // Task A and B should be in the same lane (no time overlap)
      const taskA = tasksWithLayout.find(t => t.name === 'Task A');
      const taskB = tasksWithLayout.find(t => t.name === 'Task B');
      const taskC = tasksWithLayout.find(t => t.name === 'Task C');

      expect(taskA.laneIndex).toBe(taskB.laneIndex);
      expect(taskC.laneIndex).toBe(taskA.laneIndex + 1); // Different lane due to overlap
    });

    it('should handle tasks with no time conflicts in same lane', async () => {
      const scheduledTasks = [
        createScheduledTask('Task A', 0, 3, 3),
        createScheduledTask('Task B', 4, 7, 3), // No overlap
        createScheduledTask('Task C', 8, 11, 3), // No overlap
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(3);

      // All tasks should be in the same lane since they don't overlap
      const laneIndex = tasksWithLayout[0].laneIndex;
      tasksWithLayout.forEach(task => {
        expect(task.laneIndex).toBe(laneIndex);
      });
    });
  });

  describe('Task Group Lane Separation', () => {
    it('should separate tasks from different groups into different lanes', async () => {
      const frontendGroup = createTaskGroup('Frontend Team', 'list', ['Task A', 'Task B'], 2);
      const backendGroup = createTaskGroup('Backend Team', 'list', ['Task C', 'Task D'], 1);

      const scheduledTasks = [
        createScheduledTask('Task A', 0, 5, 5, frontendGroup),
        createScheduledTask('Task B', 6, 10, 4, frontendGroup),
        createScheduledTask('Task C', 0, 3, 3, backendGroup),
        createScheduledTask('Task D', 4, 8, 4, backendGroup),
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [frontendGroup, backendGroup],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(4);

      // Frontend tasks should be in lanes 0 and 1
      const taskA = tasksWithLayout.find(t => t.name === 'Task A');
      const taskB = tasksWithLayout.find(t => t.name === 'Task B');
      
      // Backend tasks should be in lanes 2 and 3 (separate from frontend)
      const taskC = tasksWithLayout.find(t => t.name === 'Task C');
      const taskD = tasksWithLayout.find(t => t.name === 'Task D');

      // Frontend tasks should be in consecutive lanes starting from 0
      expect(taskA.laneIndex).toBe(0);
      expect(taskB.laneIndex).toBe(1);

      // Backend tasks should be in consecutive lanes after frontend
      expect(taskC.laneIndex).toBe(2);
      expect(taskD.laneIndex).toBe(3);

      // Verify group keys are set correctly
      expect(taskA.groupKey).toBe('Frontend Team');
      expect(taskB.groupKey).toBe('Frontend Team');
      expect(taskC.groupKey).toBe('Backend Team');
      expect(taskD.groupKey).toBe('Backend Team');
    });

    it('should handle tasks with time conflicts within the same group', async () => {
      const frontendGroup = createTaskGroup('Frontend Team', 'list', ['Task A', 'Task B'], 1);
      const backendGroup = createTaskGroup('Backend Team', 'list', ['Task C'], 1);

      const scheduledTasks = [
        createScheduledTask('Task A', 0, 5, 5, frontendGroup),
        createScheduledTask('Task B', 2, 8, 6, frontendGroup), // Overlaps with Task A
        createScheduledTask('Task C', 0, 3, 3, backendGroup),
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [frontendGroup, backendGroup],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(3);

      const taskA = tasksWithLayout.find(t => t.name === 'Task A');
      const taskB = tasksWithLayout.find(t => t.name === 'Task B');
      const taskC = tasksWithLayout.find(t => t.name === 'Task C');

      // Frontend tasks should be in different lanes due to overlap
      expect(taskA.laneIndex).toBe(0);
      expect(taskB.laneIndex).toBe(1);

      // Backend task should be in a separate lane group
      expect(taskC.laneIndex).toBe(2);
    });

    it('should handle mixed grouped and ungrouped tasks', async () => {
      const frontendGroup = createTaskGroup('Frontend Team', 'list', ['Task A'], 1);

      const scheduledTasks = [
        createScheduledTask('Task A', 0, 5, 5, frontendGroup),
        createScheduledTask('Task B', 0, 3, 3), // No group assigned
        createScheduledTask('Task C', 6, 10, 4), // No group assigned
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [frontendGroup],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(3);

      const taskA = tasksWithLayout.find(t => t.name === 'Task A');
      const taskB = tasksWithLayout.find(t => t.name === 'Task B');
      const taskC = tasksWithLayout.find(t => t.name === 'Task C');

      // Frontend task should be in lane 0
      expect(taskA.laneIndex).toBe(0);
      expect(taskA.groupKey).toBe('Frontend Team');

      // Ungrouped tasks should be in lanes after the frontend group
      expect(taskB.laneIndex).toBe(1);
      expect(taskC.laneIndex).toBe(2);
      expect(taskB.groupKey).toBe('global');
      expect(taskC.groupKey).toBe('global');
    });

    it('should handle regex-based task groups', async () => {
      const backendGroup = createTaskGroup('Backend Team', 'regex', ['backend-.*'], 1);

      const scheduledTasks = [
        createScheduledTask('backend-login', 0, 5, 5, backendGroup),
        createScheduledTask('backend-data', 6, 10, 4, backendGroup),
        createScheduledTask('frontend-home', 0, 3, 3), // No group
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [backendGroup],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(3);

      const backendLogin = tasksWithLayout.find(t => t.name === 'backend-login');
      const backendData = tasksWithLayout.find(t => t.name === 'backend-data');
      const frontendHome = tasksWithLayout.find(t => t.name === 'frontend-home');

      // Backend tasks should be in consecutive lanes
      expect(backendLogin.laneIndex).toBe(0);
      expect(backendData.laneIndex).toBe(1);
      expect(backendLogin.groupKey).toBe('Backend Team');
      expect(backendData.groupKey).toBe('Backend Team');

      // Frontend task should be in a separate lane group
      expect(frontendHome.laneIndex).toBe(2);
      expect(frontendHome.groupKey).toBe('global');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty scheduled tasks array', async () => {
      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks: [],
          taskGroups: [],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(0);
    });

    it('should handle tasks with zero duration', async () => {
      const scheduledTasks = [
        createScheduledTask('Task A', 0, 0, 0),
        createScheduledTask('Task B', 1, 1, 0),
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(2);

      // Tasks with zero duration should still get proper layout properties
      tasksWithLayout.forEach(task => {
        expect(task.x).toBeDefined();
        expect(task.y).toBeDefined();
        expect(task.width).toBe(0); // Zero duration = zero width
        expect(task.height).toBeDefined();
        expect(task.laneIndex).toBeDefined();
      });
    });

    it('should handle tasks with missing assignedBandwidthGroup property', async () => {
      const scheduledTasks = [
        createScheduledTask('Task A', 0, 5, 5), // No assignedBandwidthGroup
        createScheduledTask('Task B', 6, 10, 4), // No assignedBandwidthGroup
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(2);

      // Tasks without assignedBandwidthGroup should be treated as global
      tasksWithLayout.forEach(task => {
        expect(task.groupKey).toBe('global');
      });
    });
  });

  describe('Layout Properties', () => {
    it('should calculate correct layout properties for tasks', async () => {
      const scheduledTasks = [
        createScheduledTask('Task A', 0, 5, 5),
      ];

      wrapper = mount(TaskVisualizationCanvas, {
        props: {
          scheduledTasks,
          taskGroups: [],
          errors: []
        },
        global: {
          components: {
            'v-stage': mockVueKonva.vStage,
            'v-layer': mockVueKonva.vLayer,
            'v-rect': mockVueKonva.vRect,
            'v-text': mockVueKonva.vText,
            'TaskHoverCard': mockTaskHoverCard
          }
        }
      });

      await wrapper.vm.$nextTick();

      const tasksWithLayout = wrapper.vm.tasksWithLayout;
      expect(tasksWithLayout).toHaveLength(1);

      const task = tasksWithLayout[0];

      // Check that all required layout properties are present
      expect(task.x).toBeDefined();
      expect(task.y).toBeDefined();
      expect(task.width).toBeDefined();
      expect(task.height).toBeDefined();
      expect(task.laneIndex).toBeDefined();
      expect(task.groupKey).toBeDefined();

      // Check that properties have reasonable values
      expect(task.x).toBeGreaterThanOrEqual(0);
      expect(task.y).toBeGreaterThanOrEqual(0);
      expect(task.width).toBeGreaterThan(0);
      expect(task.height).toBeGreaterThan(0);
      expect(task.laneIndex).toBeGreaterThanOrEqual(0);
    });
  });
}); 