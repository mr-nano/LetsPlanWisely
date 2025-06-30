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

      // Frontend and backend tasks should be in different lane ranges
      const frontendTasks = tasksWithLayout.filter(t => t.groupKey === 'Frontend Team');
      const backendTasks = tasksWithLayout.filter(t => t.groupKey === 'Backend Team');
      const frontendLanes = new Set(frontendTasks.map(t => t.laneIndex));
      const backendLanes = new Set(backendTasks.map(t => t.laneIndex));
      // No overlap in lane indices between groups
      frontendLanes.forEach(lane => {
        backendLanes.forEach(blane => {
          expect(lane).not.toBe(blane);
        });
      });
      // No more than bandwidth lanes used per group
      expect(frontendLanes.size).toBeLessThanOrEqual(frontendGroup.bandwidth);
      expect(backendLanes.size).toBeLessThanOrEqual(backendGroup.bandwidth);
    });

    it('should handle tasks with time conflicts within the same group', async () => {
      const frontendGroup = createTaskGroup('Frontend Team', 'list', ['Task A', 'Task B'], 2);
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
      const frontendTasks = tasksWithLayout.filter(t => t.groupKey === 'Frontend Team');
      const frontendLanes = new Set(frontendTasks.map(t => t.laneIndex));
      // Should use at most 2 lanes for frontend group
      expect(frontendLanes.size).toBeLessThanOrEqual(frontendGroup.bandwidth);
    });

    it('should handle regex-based task groups', async () => {
      const backendGroup = createTaskGroup('Backend Team', 'regex', ['Backend-*'], 2);
      const scheduledTasks = [
        createScheduledTask('Backend Login', 0, 5, 5, backendGroup),
        createScheduledTask('Backend Data', 6, 10, 4, backendGroup),
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
      expect(tasksWithLayout).toHaveLength(2);
      const backendTasks = tasksWithLayout.filter(t => t.groupKey === 'Backend Team');
      const backendLanes = new Set(backendTasks.map(t => t.laneIndex));
      // Should use at most 2 lanes for backend group
      expect(backendLanes.size).toBeLessThanOrEqual(backendGroup.bandwidth);
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

  it('should not exceed group bandwidth in number of lanes (bandwidth-limited lane assignment)', async () => {
    const frontendGroup = createTaskGroup('Frontend Team', 'regex', ['Frontend-*'], 2);
    const scheduledTasks = [
      createScheduledTask('Frontend Task', 0, 5, 5, frontendGroup),
      createScheduledTask('Frontend Task2', 0, 5, 5, frontendGroup),
      createScheduledTask('Frontend Task3', 0, 5, 5, frontendGroup),
      createScheduledTask('Frontend Task4', 0, 5, 5, frontendGroup),
      createScheduledTask('Frontend Task5', 0, 5, 5, frontendGroup),
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
    expect(tasksWithLayout).toHaveLength(5);
    // All tasks should be assigned to only 2 lanes (bandwidth = 2)
    const frontendLanes = new Set(tasksWithLayout.map(t => t.laneIndex));
    expect(frontendLanes.size).toBeLessThanOrEqual(2);
  });

  it('should render a group box around all tasks in the same group', async () => {
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
    // Check for group box elements (e.g., by data-testid or class)
    const groupBoxes = wrapper.findAll('[data-testid^="group-box-"]');
    // Should be one box per group
    expect(groupBoxes.length).toBe(2);
    // Optionally, check that each box visually contains all its group's tasks (by bounding box math or DOM hierarchy)
  });

  it('should render a group box for a single group with a single task', async () => {
    const group = createTaskGroup('Solo Group', 'list', ['Task A'], 1);
    const scheduledTasks = [createScheduledTask('Task A', 0, 5, 5, group)];
    wrapper = mount(TaskVisualizationCanvas, {
      props: { scheduledTasks, taskGroups: [group], errors: [] },
      global: { components: mockVueKonva }
    });
    await wrapper.vm.$nextTick();
    const groupBoxes = wrapper.findAll('[data-testid^="group-box-"]');
    expect(groupBoxes.length).toBe(1);
  });

  it('should render a group box for a single group with multiple tasks', async () => {
    const group = createTaskGroup('Multi Group', 'list', ['Task A', 'Task B'], 2);
    const scheduledTasks = [
      createScheduledTask('Task A', 0, 5, 5, group),
      createScheduledTask('Task B', 6, 10, 4, group),
    ];
    wrapper = mount(TaskVisualizationCanvas, {
      props: { scheduledTasks, taskGroups: [group], errors: [] },
      global: { components: mockVueKonva }
    });
    await wrapper.vm.$nextTick();
    const groupBoxes = wrapper.findAll('[data-testid^="group-box-"]');
    expect(groupBoxes.length).toBe(1);
  });

  it('should not render any group box for ungrouped tasks', async () => {
    const scheduledTasks = [
      createScheduledTask('Task A', 0, 5, 5),
      createScheduledTask('Task B', 6, 10, 4),
    ];
    wrapper = mount(TaskVisualizationCanvas, {
      props: { scheduledTasks, taskGroups: [], errors: [] },
      global: { components: mockVueKonva }
    });
    await wrapper.vm.$nextTick();
    const groupBoxes = wrapper.findAll('[data-testid^="group-box-"]');
    expect(groupBoxes.length).toBe(0);
  });

  it('should render multiple group boxes for different groups', async () => {
    const group1 = createTaskGroup('Group 1', 'list', ['Task A'], 1);
    const group2 = createTaskGroup('Group 2', 'list', ['Task B'], 1);
    const scheduledTasks = [
      createScheduledTask('Task A', 0, 5, 5, group1),
      createScheduledTask('Task B', 6, 10, 4, group2),
    ];
    wrapper = mount(TaskVisualizationCanvas, {
      props: { scheduledTasks, taskGroups: [group1, group2], errors: [] },
      global: { components: mockVueKonva }
    });
    await wrapper.vm.$nextTick();
    const groupBoxes = wrapper.findAll('[data-testid^="group-box-"]');
    expect(groupBoxes.length).toBe(2);
  });

  it('should label the group box with the group name', async () => {
    const group = createTaskGroup('Labeled Group', 'list', ['Task A'], 1);
    const scheduledTasks = [createScheduledTask('Task A', 0, 5, 5, group)];
    wrapper = mount(TaskVisualizationCanvas, {
      props: { scheduledTasks, taskGroups: [group], errors: [] },
      global: { components: mockVueKonva }
    });
    await wrapper.vm.$nextTick();
    const groupBox = wrapper.find('[data-testid="group-box-Labeled Group"]');
    expect(groupBox.exists()).toBe(true);
    // Optionally, check for label text
    // expect(groupBox.text()).toContain('Labeled Group');
  });

  it('should not render a group box for a group with no tasks', async () => {
    const group = createTaskGroup('Empty Group', 'list', ['Task X'], 1);
    const scheduledTasks = [];
    wrapper = mount(TaskVisualizationCanvas, {
      props: { scheduledTasks, taskGroups: [group], errors: [] },
      global: { components: mockVueKonva }
    });
    await wrapper.vm.$nextTick();
    const groupBoxes = wrapper.findAll('[data-testid^="group-box-"]');
    expect(groupBoxes.length).toBe(0);
  });
}); 