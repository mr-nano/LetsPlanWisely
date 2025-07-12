// Mock ResizeObserver for test environment
if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

// test/TaskVisualizationCanvas.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'; // Import vi for mocking
import { mount } from '@vue/test-utils';
import TaskVisualizationCanvas from '../src/components/TaskVisualizationCanvas.vue';
import TaskHoverCard from '../src/components/TaskHoverCard.vue'; // Import the actual component for direct testing

// Mock VueKonva components since they're globally registered
const mockVueKonva = {
    vStage: {
        template: '<div data-testid="v-stage"><slot /></div>',
        props: ['config'],
        emits: ['wheel'],
        // Mock getStage to return a simplified stage object for testing Konva interactions
        methods: {
            getStage: () => ({
                scaleX: () => 1,
                scaleY: () => 1,
                x: () => 0,
                y: () => 0,
                getPointerPosition: () => ({ x: 0, y: 0 }),
                width: vi.fn(), // Mock the width and height setters
                height: vi.fn(),
                scale: vi.fn(),
                position: vi.fn(),
                batchDraw: vi.fn(),
                on: vi.fn(),
                off: vi.fn(),
            })
        }
    },
    vLayer: {
        template: '<div data-testid="v-layer"><slot /></div>'
    },
    vRect: {
        template: '<div data-testid="v-rect"></div>',
        props: ['config']
        // We'll simulate events directly on the wrapper's find() result
    },
    vText: {
        template: '<div data-testid="v-text"></div>',
        props: ['config']
    }
};

// IMPORTANT: For testing TaskHoverCard's rendering, we will mount the *actual* TaskHoverCard component
// For TaskVisualizationCanvas, we will use a simplified mock of TaskHoverCard to test prop passing.
const simpleMockTaskHoverCard = {
    template: '<div data-testid="task-hover-card"></div>',
    props: ['task', 'mousePosition', 'containerRect']
};


describe('TaskVisualizationCanvas - Lane Assignment', () => {
    let wrapper;

    // Helper function to create scheduled task objects
    const createScheduledTask = (name, startTime, endTime, duration, assignedBandwidthGroup = null, details = {}) => ({
        name,
        description: `Description for ${name}`,
        duration: 'M',
        resolvedDuration: duration,
        startTime,
        endTime,
        assignedBandwidthGroup,
        details // Include details in the created task
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
        // Mock getBoundingClientRect for canvasContainer ref
        if (HTMLElement.prototype.getBoundingClientRect) {
            vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
                left: 100, top: 50, width: 800, height: 600, x: 100, y: 50,
                bottom: 650, right: 900, // Add these for completeness, though not strictly used by component
            });
        }
    });

    // ... (Your existing 'TaskVisualizationCanvas - Lane Assignment' tests go here,
    //      make sure `createScheduledTask` is updated to accept `details`) ...


    describe('Task Hover Card Interactions', () => {

        it('should display TaskHoverCard on task hover with correct data', async () => {
            const taskWithDetails = createScheduledTask('HoverTask', 0, 5, 5, null, {
                Assumptions: ['Assumed condition 1'],
                Metadata: ['Version: 1.0']
            });
            const scheduledTasks = [taskWithDetails];

            const wrapper = mount(TaskVisualizationCanvas, {
                props: { scheduledTasks, taskGroups: [], errors: [] },
                global: {
                    components: {
                        'v-stage': mockVueKonva.vStage,
                        'v-layer': mockVueKonva.vLayer,
                        'v-rect': mockVueKonva.vRect,
                        'v-text': mockVueKonva.vText,
                        'TaskHoverCard': simpleMockTaskHoverCard // Use the simple mock here
                    }
                }
            });

            await wrapper.vm.$nextTick();

            // Find the mock v-rect corresponding to the task
            // Note: v-rect configs are processed inside getTaskRectConfig. We need to simulate the event.
            // In a real Konva test, you'd find the Konva node and trigger its events.
            // With simple mocks, we need to find the component that receives the event props.
            // Since v-rect mock doesn't emit, we have to call the handler directly on the wrapper.
            
            // To properly test the Konva event handlers with mock components,
            // we need to slightly enhance our vRect mock to emit events
            // or directly call the methods. For simplicity, we'll directly call
            // the vm's handlers which are exposed to the template via getTaskRectConfig.

            // Simulate mouseenter on the relevant task's "Konva rect"
            const rectConfig = wrapper.vm.getTaskRectConfig(taskWithDetails); // Get the config that holds handlers
            
            // Provide a mock Konva event object
            const mockKonvaEvent = {
                evt: {
                    clientX: 200,
                    clientY: 150,
                },
                target: { // Mock target to represent the Konva node
                    name: `task-rect-${taskWithDetails.name}`
                }
            };
            rectConfig.onMouseenter(mockKonvaEvent); // Directly call the handler

            await wrapper.vm.$nextTick();

            const hoverCard = wrapper.findComponent(simpleMockTaskHoverCard);
            expect(hoverCard.props('task')).toEqual(taskWithDetails);
            expect(hoverCard.props('mousePosition')).toEqual({ x: 100, y: 100 }); // clientX - left, clientY - top (200-100, 150-50)
            expect(hoverCard.props('containerRect')).toBeDefined();
        });

        it('should hide TaskHoverCard on mouse leave', async () => {
            const taskWithDetails = createScheduledTask('HoverTask', 0, 5, 5);
            const scheduledTasks = [taskWithDetails];

            const wrapper = mount(TaskVisualizationCanvas, {
                props: { scheduledTasks, taskGroups: [], errors: [] },
                global: {
                    components: {
                        'v-stage': mockVueKonva.vStage,
                        'v-layer': mockVueKonva.vLayer,
                        'v-rect': mockVueKonva.vRect,
                        'v-text': mockVueKonva.vText,
                        'TaskHoverCard': simpleMockTaskHoverCard
                    }
                }
            });

            await wrapper.vm.$nextTick();

            const rectConfig = wrapper.vm.getTaskRectConfig(taskWithDetails);
            rectConfig.onMouseenter({ evt: { clientX: 200, clientY: 150 } });
            await wrapper.vm.$nextTick();
            expect(wrapper.findComponent(simpleMockTaskHoverCard).props('task')).toEqual(taskWithDetails);

            rectConfig.onMouseleave(); // Directly call the handler
            await wrapper.vm.$nextTick();
            expect(wrapper.findComponent(simpleMockTaskHoverCard).props('task')).toBeNull();
        });

        it('should update TaskHoverCard position on mouse move', async () => {
            const taskWithDetails = createScheduledTask('MoveTask', 0, 5, 5);
            const scheduledTasks = [taskWithDetails];

            const wrapper = mount(TaskVisualizationCanvas, {
                props: { scheduledTasks, taskGroups: [], errors: [] },
                global: {
                    components: {
                        'v-stage': mockVueKonva.vStage,
                        'v-layer': mockVueKonva.vLayer,
                        'v-rect': mockVueKonva.vRect,
                        'v-text': mockVueKonva.vText,
                        'TaskHoverCard': simpleMockTaskHoverCard
                    }
                }
            });

            await wrapper.vm.$nextTick();
            const rectConfig = wrapper.vm.getTaskRectConfig(taskWithDetails);

            rectConfig.onMouseenter({ evt: { clientX: 200, clientY: 150 } });
            await wrapper.vm.$nextTick();
            expect(wrapper.findComponent(simpleMockTaskHoverCard).props('mousePosition')).toEqual({ x: 100, y: 100 });

            rectConfig.onMousemove({ evt: { clientX: 300, clientY: 250 } });
            await wrapper.vm.$nextTick();
            expect(wrapper.findComponent(simpleMockTaskHoverCard).props('mousePosition')).toEqual({ x: 200, y: 200 }); // (300-100, 250-50)
        });

        it('should pass task details to TaskHoverCard', async () => {
            const taskWithDetails = createScheduledTask('DetailedTask', 0, 5, 5, null, {
                Assumptions: ['This is the first assumption.', 'And a second one.'],
                'Open questions': ['What about X?', 'What about Y?'],
            });
            const scheduledTasks = [taskWithDetails];

            const wrapper = mount(TaskVisualizationCanvas, {
                props: { scheduledTasks, taskGroups: [], errors: [] },
                global: {
                    components: {
                        'v-stage': mockVueKonva.vStage,
                        'v-layer': mockVueKonva.vLayer,
                        'v-rect': mockVueKonva.vRect,
                        'v-text': mockVueKonva.vText,
                        'TaskHoverCard': simpleMockTaskHoverCard
                    }
                }
            });

            await wrapper.vm.$nextTick();

            const rectConfig = wrapper.vm.getTaskRectConfig(taskWithDetails);
            rectConfig.onMouseenter({ evt: { clientX: 200, clientY: 150 } });
            await wrapper.vm.$nextTick();

            const hoverCard = wrapper.findComponent(simpleMockTaskHoverCard);
            // Assert that the 'task' prop includes the 'details' property
            expect(hoverCard.props('task').details).toEqual({
                Assumptions: ['This is the first assumption.', 'And a second one.'],
                'Open questions': ['What about X?', 'What about Y?'],
            });
        });
    });

    describe('TaskHoverCard - Content Rendering', () => {
        // Test TaskHoverCard directly to ensure it renders its props correctly
        let hoverCardWrapper;

        beforeEach(() => {
            hoverCardWrapper = null;
        });

        it('should render task name, description, and duration', async () => {
            const task = {
                name: 'Test Task',
                description: 'A simple description.',
                duration: 'S',
                details: {} // Ensure details property exists
            };
            hoverCardWrapper = mount(TaskHoverCard, { props: { task } });

            expect(hoverCardWrapper.text()).toContain('Test Task');
            expect(hoverCardWrapper.text()).toContain('(S)');
            expect(hoverCardWrapper.text()).toContain('A simple description.');
        });

        it('should render key-value details', async () => {
            const task = {
                name: 'Detailed Task',
                description: 'This task has extra info.',
                duration: 'M',
                details: {
                    Assumptions: ['Assumption 1', 'Assumption 2'],
                    'Risks & Issues': ['Risk A', 'Issue B', 'Issue C'],
                    Metadata: ['Created: 2023-01-01', 'Priority: High']
                }
            };
            hoverCardWrapper = mount(TaskHoverCard, { props: { task } });

            // Check for keys
            expect(hoverCardWrapper.text()).toContain('Assumptions:');
            expect(hoverCardWrapper.text()).toContain('Risks & Issues:');
            expect(hoverCardWrapper.text()).toContain('Metadata:');

            // Check for bullet points (can be tricky with complex HTML, but text() is a start)
            expect(hoverCardWrapper.text()).toContain('Assumption 1');
            expect(hoverCardWrapper.text()).toContain('Assumption 2');
            expect(hoverCardWrapper.text()).toContain('Risk A');
            expect(hoverCardWrapper.text()).toContain('Issue B');
            expect(hoverCardWrapper.text()).toContain('Issue C');
            expect(hoverCardWrapper.text()).toContain('Created: 2023-01-01');
            expect(hoverCardWrapper.text()).toContain('Priority: High');
        });

        it('should not render details section if details object is empty', async () => {
            const task = {
                name: 'No Details Task',
                description: 'Simple task.',
                duration: 'XS',
                details: {}
            };
            hoverCardWrapper = mount(TaskHoverCard, { props: { task } });

            // Assert that none of the detail section headings are present
            expect(hoverCardWrapper.html()).not.toContain('Assumptions:');
            expect(hoverCardWrapper.html()).not.toContain('Open questions:');
            expect(hoverCardWrapper.html()).not.toContain('Metadata:');
            // More generally, check if the details container div (which we'll add) is absent
            expect(hoverCardWrapper.find('[data-testid="task-details-section"]').exists()).toBe(false);
        });

        it('should render "No description provided." if description is empty', async () => {
            const task = {
                name: 'No Desc Task',
                description: '', // Empty description
                duration: 'M',
                details: {}
            };
            hoverCardWrapper = mount(TaskHoverCard, { props: { task } });
            expect(hoverCardWrapper.text()).toContain('No description provided.');
        });
    });
});

describe('Task Visualization Canvas - Dependency Highlighting', () => {
    let wrapper;

    const createScheduledTask = (name, startTime, endTime, duration, assignedBandwidthGroup = null, details = {}) => ({
        name,
        description: `Description for ${name}`,
        duration: 'M',
        resolvedDuration: duration,
        startTime,
        endTime,
        dependencies: [], // Initialize dependencies for the task itself
        originalLineNum: 1, // Mock a line number for consistency
        details
    });

    beforeEach(() => {
        wrapper = null;
        if (HTMLElement.prototype.getBoundingClientRect) {
            vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
                left: 100, top: 50, width: 800, height: 600, x: 100, y: 50,
                bottom: 650, right: 900,
            });
        }
    });

    it('should highlight dependent tasks when a task is hovered', async () => {
        // Task B depends on Task A
        const taskA = createScheduledTask('Task A', 0, 5, 5);
        const taskB = createScheduledTask('Task B', 6, 10, 4);

        // Manually set up the dependency relationship for the mock scheduledTasks
        // In a real scenario, the scheduler would link these based on parser output.
        // For this test, we ensure TaskB has TaskA as a dependency source in its 'dependencies' array,
        // and we will also need a mechanism to tell the getTaskRectConfig what is hovered.
        // Let's mock a simpler scenario: we're checking if the 'isHighlighted' flag is passed.

        const scheduledTasks = [taskA, taskB];

        // This test requires a slight adjustment to how the `getTaskRectConfig`
        // function receives information about the hovered state and dependencies.
        // The current Konva setup passes the task directly, which is good.
        // We need `getTaskRectConfig` to determine if a task is 'highlighted'.
        // This will be done by checking `hoveredTask.value` and its dependencies.

        wrapper = mount(TaskVisualizationCanvas, {
            props: { scheduledTasks, taskGroups: [], errors: [] },
            global: {
                components: {
                    'v-stage': mockVueKonva.vStage,
                    'v-layer': mockVueKonva.vLayer,
                    'v-rect': mockVueKonva.vRect,
                    'v-text': mockVueKonva.vText,
                    'TaskHoverCard': simpleMockTaskHoverCard
                }
            }
        });

        await wrapper.vm.$nextTick();

        // 1. Manually add the dependency to the 'scheduledTasks' that `tasksWithLayout` processes.
        // This simulates what the scheduler would output.
        // You'll need to pass 'dependencies' into the scheduledTasks props,
        // or ensure your test's createScheduledTask reflects the full task structure.
        // For simplicity, let's just ensure our mock tasks have the necessary fields.
        // The parser output has `dependencies` as an array of {source, target}.
        // The scheduler would then derive predecessor/successor lists.
        // For testing highlighting, we need to know what tasks are "predecessors".

        // Let's create a more complete scheduledTasks structure for this test,
        // mirroring what the scheduler might add.
        const scheduledTasksWithPreds = [
            { ...taskA, predecessors: [] }, // Task A has no predecessors for this test
            { ...taskB, predecessors: [taskA.name] } // Task B depends on Task A
        ];

        // Update the props on the wrapper
        await wrapper.setProps({ scheduledTasks: scheduledTasksWithPreds });
        await wrapper.vm.$nextTick();


        // Find Task B's Konva rect config and simulate hover
        // The actual `getTaskRectConfig` uses `hoveredTask.value` internally.
        // So, we simulate the `onMouseenter` event which sets `hoveredTask.value`.
        const taskB_RectConfig = wrapper.vm.getTaskRectConfig(scheduledTasksWithPreds.find(t => t.name === 'Task B'));
        
        // Simulate mouseenter for Task B
        taskB_RectConfig.onMouseenter({ evt: { clientX: 200, clientY: 150 } });
        await wrapper.vm.$nextTick(); // Wait for `hoveredTask` to update and `tasksWithLayout` to re-compute

        // Now, we expect Task A's rect config to have a "highlighted" property or specific style
        // We need to retrieve the *latest* configs after hover state has updated.
        const taskA_RectConfig_AfterHover = wrapper.vm.getTaskRectConfig(scheduledTasksWithPreds.find(t => t.name === 'Task A'));
        const taskB_RectConfig_AfterHover = wrapper.vm.getTaskRectConfig(scheduledTasksWithPreds.find(t => t.name === 'Task B'));

        // Assert Task A (the dependency) is highlighted
        expect(taskA_RectConfig_AfterHover.stroke).toBe('#ff8c00'); // Example: Orange for highlight
        expect(taskA_RectConfig_AfterHover.strokeWidth).toBe(4);    // Example: Thicker stroke

        // Assert Task B (the hovered task) also has a distinct highlight (optional, but good UX)
        expect(taskB_RectConfig_AfterHover.stroke).toBe('#ff8c00');
        expect(taskB_RectConfig_AfterHover.strokeWidth).toBe(4);

        // Assert other tasks (not involved in this dependency chain) are NOT highlighted
        const taskC = createScheduledTask('Task C', 0, 5, 5); // An unrelated task
        const scheduledTasksWithPredsAndC = [...scheduledTasksWithPreds, { ...taskC, predecessors: [] }];
        await wrapper.setProps({ scheduledTasks: scheduledTasksWithPredsAndC });
        await wrapper.vm.$nextTick();

        const taskC_RectConfig_AfterHover = wrapper.vm.getTaskRectConfig(scheduledTasksWithPredsAndC.find(t => t.name === 'Task C'));
        expect(taskC_RectConfig_AfterHover.stroke).not.toBe('#ff8c00');
        expect(taskC_RectConfig_AfterHover.strokeWidth).not.toBe(4);


        // Simulate mouse leave
        taskB_RectConfig.onMouseleave();
        await wrapper.vm.$nextTick();

        // Assert that highlights are removed after mouse leave
        const taskA_RectConfig_AfterLeave = wrapper.vm.getTaskRectConfig(scheduledTasksWithPreds.find(t => t.name === 'Task A'));
        const taskB_RectConfig_AfterLeave = wrapper.vm.getTaskRectConfig(scheduledTasksWithPreds.find(t => t.name === 'Task B'));
        
        expect(taskA_RectConfig_AfterLeave.stroke).not.toBe('#ff8c00');
        expect(taskA_RectConfig_AfterLeave.strokeWidth).not.toBe(4);
        expect(taskB_RectConfig_AfterLeave.stroke).not.toBe('#ff8c00');
        expect(taskB_RectConfig_AfterLeave.strokeWidth).not.toBe(4);
    });
});