// src/tests/parser.test.js
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/utils/parser'; // Adjust path if necessary

describe('parseMarkdown - Existing Functionality', () => {

    it('should parse a basic task definition', () => {
        const markdown = `Task "Task A" "Description A" "M"
        M:1
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]).toEqual(expect.objectContaining({
            name: 'Task A',
            description: 'Description A',
            duration: 'M',
            dependencies: [],
            resolvedDuration: 1, // Default, will be updated by scheduler
        }));
        expect(result.errors).toHaveLength(0);
    });

    it('should parse a task with inline dependencies', () => {
        const markdown = `
        Task "Task A" "Description A" "L"
        Task "Task B" "Description B" "L" "Task A"
        L:10`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0].name).toBe('Task A');
        expect(result.tasks[1].dependencies).toEqual(['Task A']);
        expect(result.errors).toHaveLength(0);
    });

    it('should parse a task with multiple inline dependencies', () => {
        const markdown = `
        Task "Task A" "Description A" "L"
        Task "Task B" "Description B" "L" "Task A"
        Task "Task C" "Description C" "S" "Task A, Task B"
        L:10
        S:1
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(3);
        expect(result.tasks[2].dependencies).toEqual(['Task A', 'Task B']);
        expect(result.durationLabels).toEqual({ L: 10, S: 1 });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse duration label definitions', () => {
        const markdown = `
        Task "A" "" "L"
        L:10
        M:5.5
        `;
        const result = parseMarkdown(markdown);
        expect(result.durationLabels).toEqual({ L: 10, M: 5.5 });
        expect(result.errors).toHaveLength(0);
    });

    it('should handle duplicate duration label definitions with warning', () => {
        const markdown = `
        Task "A" "" "L"
        L:10
        L:12
        `;
        const result = parseMarkdown(markdown);
        expect(result.durationLabels).toEqual({ L: 12 }); // Last one takes precedence
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'warning',
            message: expect.stringContaining('Duplicate definition for duration label "L"'),
        }));
    });

    it('should parse global bandwidth as number', () => {
        const markdown = `Global Bandwidth: 5`;
        const result = parseMarkdown(markdown);
        expect(result.globalBandwidth).toBe(5);
        expect(result.errors).toHaveLength(0);
    });

    it('should parse global bandwidth as unbound', () => {
        const markdown = `Global Bandwidth: "unbound"`;
        const result = parseMarkdown(markdown);
        expect(result.globalBandwidth).toBe('unbound');
        expect(result.errors).toHaveLength(0);
    });

    it('should handle invalid global bandwidth with error', () => {
        const markdown = `Global Bandwidth: abc`;
        const result = parseMarkdown(markdown);
        expect(result.globalBandwidth).toBe('unbound'); // Default or previous value
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Unrecognized or malformed line syntax: "Global Bandwidth: abc"'),
        }));
    });

    it('should parse task group by list', () => {
        const markdown = `
        Task "Task A" "Desc" "M"
        Task "Task B" "Desc" "M"
        Task Group "Development Team" ["Task A", "Task B"] bandwidth: 3
        M:5
        `;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'list',
            name: 'Development Team',
            identifiers: ['Task A', 'Task B'],
            startDate: null,
            bandwidth: 3,
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse task group by regex', () => {
        const markdown = `Task Group "Backend Services" /backend-*/ bandwidth: "unbound"`;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'regex',
            name: 'Backend Services',
            identifiers: ['backend-*'],
            startDate: null,
            bandwidth: 'unbound',
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse task group without name (backward compatibility)', () => {
        const markdown = `
        Task "Task A" "Desc" "M"
        Task "Task B" "Desc" "M"
        Task Group ["Task A", "Task B"] bandwidth: 3
        M:5
        `;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'list',
            name: 'Unnamed Group', // Default name when none provided
            identifiers: ['Task A', 'Task B'],
            startDate: null,
            bandwidth: 3,
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse task group by regex without name (backward compatibility)', () => {
        const markdown = `Task Group /backend-*/ bandwidth: "unbound"`;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'regex',
            name: 'Unnamed Group', // Default name when none provided
            identifiers: ['backend-*'],
            startDate: null,
            bandwidth: 'unbound',
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse multiple task groups with different names', () => {
        const markdown = `
        Task "Frontend Task" "Desc" "M"
        Task "Backend Task" "Desc" "M"
        Task "API Task" "Desc" "M"
        Task "Database Task" "Desc" "M"
        
        Task Group "Frontend Team" ["Frontend Task"] bandwidth: 2
        Task Group "Backend Team" ["Backend Task", "API Task"] bandwidth: 3
        Task Group "Database Team" /Database*/ bandwidth: 1
        
        M:5
        `;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(3);
        expect(result.taskGroups[0]).toEqual({
            type: 'list',
            name: 'Frontend Team',
            identifiers: ['Frontend Task'],
            startDate: null,
            bandwidth: 2,
        });
        expect(result.taskGroups[1]).toEqual({
            type: 'list',
            name: 'Backend Team',
            identifiers: ['Backend Task', 'API Task'],
            startDate: null,
            bandwidth: 3,
        });
        expect(result.taskGroups[2]).toEqual({
            type: 'regex',
            name: 'Database Team',
            identifiers: ['Database*'],
            startDate: null,
            bandwidth: 1,
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed task group syntax with error', () => {
        const markdown = `Task Group "Invalid Group" bandwidth: 3`;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Unrecognized or malformed line syntax'),
        }));
    });

    it('should handle task group with empty name', () => {
        const markdown = `
        Task "Task A" "Desc" "M"
        Task Group "" ["Task A"] bandwidth: 3
        M:5
        `;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'list',
            name: 'Unnamed Group', // Should default to unnamed when empty string provided
            identifiers: ['Task A'],
            bandwidth: 3,
            startDate: null,
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse explicit dependency statements', () => {
        const markdown = `
        Task "Task A" "Desc" "M"
        Task "Task B" "Desc" "M"
        Task "Task C" "Desc" "M"
        Task "Task D" "Desc" "M"
        Task "Task E" "Desc" "M"
        
        "Task B" should happen before "Task A"
        "Task C" depends on "Task B"
        "Task D" should happen after "Task E"

        M:1
        `;
        const result = parseMarkdown(markdown);
        expect(result.dependencies).toHaveLength(3);
        expect(result.dependencies[0]).toEqual({ source: 'Task B', target: 'Task A' }); // A should be first then B
        expect(result.dependencies[1]).toEqual({ source: 'Task B', target: 'Task C' }); // C should be first then B
        expect(result.dependencies[2]).toEqual({ source: 'Task E', target: 'Task D' }); // E should be first then D
        expect(result.errors).toHaveLength(0);
    });

    it('should ignore lines starting with // as comments', () => {
        const markdown = `
        // This is a comment
        Task "A" "" "L"
        // Another comment
        L:10
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].name).toBe('A');
        expect(result.durationLabels).toEqual({ L: 10 });
        expect(result.errors).toHaveLength(0);
    });

    it('should report an error for an unrecognized line', () => {
        const markdown = `
        L:10
        Task "A" "" "L"
        Invalid line syntax here
        `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Unrecognized or malformed line syntax'),
            line: 4 // Expecting line number 3 based on input
        }));
    });

    it('should handle a complex valid markdown input', () => {
        const markdown = `
        Task "Develop UI" "Implement frontend" "M" "Code Backend"
        Task "Code Backend" "Develop API and DB" "L"
        Task "Write Docs" "Prepare user documentation" "S" "Develop UI"
        "Write Docs" depends on "Develop UI" // Explicit dependency

        Global Bandwidth: 2
        L:10
        M:5
        S:2
        XL:15

        Task Group "Development Team" ["Develop UI", "Code Backend"] bandwidth: 1
        `;
        const result = parseMarkdown(markdown);

        console.log("Results logs", JSON.stringify(result, null, 2));

        expect(result.tasks).toHaveLength(3);
        expect(result.durationLabels).toEqual({ L: 10, M: 5, S: 2, XL: 15 });
        expect(result.globalBandwidth).toBe(2);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'list',
            name: 'Development Team',
            identifiers: ['Develop UI', 'Code Backend'],
            startDate: null,
            bandwidth: 1,
        });
        expect(result.dependencies).toEqual([
            { source: 'Code Backend', target: 'Develop UI' }, // Inline from "Develop UI"
            { source: 'Develop UI', target: 'Write Docs' } // Explicit

        ]);
        expect(result.errors).toHaveLength(0);
    });

    it('should flag tasks with unresolved duration labels', () => {
        const markdown = `Task "Invalid Task" "Desc" "XYZ"`;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('has an undefined duration label: "XYZ"'),
        }));
    });

    it('should handle empty markdown input', () => {
        const markdown = ``;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(0);
        expect(result.dependencies).toHaveLength(0);
        expect(result.durationLabels).toEqual({});
        expect(result.globalBandwidth).toBe('unbound');
        expect(result.taskGroups).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });

    it('should handle task depending on itself', () => {
        const markdown = `
        M:1
        Task "SelfDep" "Desc" "M" "SelfDep"
        `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('cannot depend on itself'),
        }));
    });

    it('should validate all referenced tasks in dependencies', () => {
        const markdown = `
        M:1
        Task "A" "" "M" "NonExistent"
        "NonExistent2" should happen before "A"
        `;
        const result = parseMarkdown(markdown);
        console.log("Errors are", result.errors)
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].message).toContain('Dependency source task "NonExistent" is not defined.');
        expect(result.errors[1].message).toContain('Dependency source task "NonExistent2" is not defined.');
    });

    it('should validate task group identifiers', () => {
        const markdown = `
        M:1
        Task "ExistingTask" "" "M"
        Task Group "Test Group" [ExistingTask, "NonExistentTask"] bandwidth: 1
        `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Task Group references undefined task "NonExistentTask"');
    });

    it('should handle blank lines correctly', () => {
        const markdown = `
        M:1
        Task "A" "Desc" "M"

        Task "B" "Desc" "M"
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
    });

    it('should parse comments at the end of a line', () => {
        const markdown = `
        Task "Task A" "Desc" "L" # This is a comment
        L:10 // Another comment
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.durationLabels).toEqual({ L: 10 });
        expect(result.errors).toHaveLength(0);
    });
});

describe('parseMarkdown - Enhanced Task Details (Key-Value Pairs)', () => {

    // Test Case 1: Basic key-value pair with a single bullet point
    it('should parse a task with basic key-value pairs (single bullet)', () => {
        const markdown = `
M:5
Task "Task with Details" "Desc" "M"
    Assumptions:
        - First assumption
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].name).toBe('Task with Details');
        expect(result.tasks[0].details).toEqual({
            Assumptions: ['First assumption'],
        });
        console.log("Errors are", JSON.stringify(result.errors, null, 2))
        expect(result.errors).toHaveLength(0);
    });

    // Test Case 2: Multiple key-value pairs with multiple bullet points
    // Test Case 2: Multiple key-value pairs with multiple bullet points
    it('should parse a task with multiple key-value pairs and multi-line bullet points', () => {
        const markdown = `
L:10
Task "Dependency A" "Some desc" "L"
Task "Complex Task" "Long Description" "L" "Dependency A"
    Assumptions:
        - This is the first assumption.
        - And a second one.
        - A third one as well.
    Open questions:
        - What about the integration?
        - Who is responsible for testing?
    Metadata:
        - Version: 1.0
        - Author: John Doe
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);

        // Get tasks by their expected name, not just by index 0
        const dependencyATask = result.tasks.find(t => t.name === 'Dependency A');
        const complexTask = result.tasks.find(t => t.name === 'Complex Task');

        // Assert "Dependency A" task
        expect(dependencyATask).toBeDefined();
        expect(dependencyATask.name).toBe('Dependency A');
        expect(dependencyATask.description).toBe('Some desc');
        expect(dependencyATask.duration).toBe('L');
        expect(dependencyATask.details).toEqual({}); // It should have no details
        expect(dependencyATask.dependencies).toEqual([]); // No inline dependencies defined for it

        // Assert "Complex Task" task
        expect(complexTask).toBeDefined();
        expect(complexTask.name).toBe('Complex Task');
        expect(complexTask.description).toBe('Long Description');
        expect(complexTask.duration).toBe('L');
        expect(complexTask.dependencies).toEqual(['Dependency A']); // Check inline dependency
        expect(complexTask.details).toEqual({
            Assumptions: [
                'This is the first assumption.',
                'And a second one.',
                'A third one as well.',
            ],
            'Open questions': [
                'What about the integration?',
                'Who is responsible for testing?',
            ],
            Metadata: ['Version: 1.0', 'Author: John Doe'],
        });

        console.log("Errors are", JSON.stringify(result.errors, null, 2))
        expect(result.errors).toHaveLength(0);

        // Optionally, check overall dependencies if you want to be thorough
        expect(result.dependencies).toEqual([
            { source: 'Dependency A', target: 'Complex Task' }
        ]);
    });

    // Test Case 3: Task with details followed by another task
    it('should correctly parse task details and then another task', () => {
        const markdown = `
S:1
M:2
Task "Task One" "Description One" "S"
    Notes:
        - Some note here
Task "Task Two" "Description Two" "M"
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0].name).toBe('Task One');
        expect(result.tasks[0].details).toEqual({ Notes: ['Some note here'] });
        expect(result.tasks[1].name).toBe('Task Two');
        expect(result.tasks[1].details).toEqual({}); // Ensure no details are inherited
        expect(result.errors).toHaveLength(0);
    });

    // Test Case 4: Inconsistent indentation for a key (error case)
    it.skip('should report an error for inconsistent indentation of a key', () => {
        const markdown = `
M:1
Task "Bad Indentation" "Desc" "M"
        Assumptions:  // Too much indentation
            - An assumption
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].name).toBe('Bad Indentation');
        expect(result.tasks[0].details).toEqual({}); // No details should be parsed
        console.log(JSON.stringify(result.errors, null, 2))
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Inconsistent or incorrect indentation for task detail key'),
            line: 3,
        }));
    });

    // Test Case 5: Inconsistent indentation for a bullet point (error case)
    it.skip('should report an error for inconsistent indentation of a bullet point', () => {
        const markdown = `
M:1
Task "Bad Bullet Indentation" "Desc" "M"
    Assumptions:
    - An assumption  // Too little indentation for bullet
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].name).toBe('Bad Bullet Indentation');
        console.log(JSON.stringify(result, null, 2))
        expect(result.tasks[0].details).toEqual({}); // No details should be parsed
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Inconsistent or incorrect indentation for task detail value'),
            line: 4,
        }));
    });

    // Test Case 6: Key without any bullet points
    it('should parse a key-value pair with an empty list of bullet points', () => {
        const markdown = `
M:1
Task "Empty Key" "Desc" "M"
    Empty Section:
Task "Next Task" "Desc" "M"
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0].name).toBe('Empty Key');
        expect(result.tasks[0].details).toEqual({ 'Empty Section': [] });
        expect(result.errors).toHaveLength(0);
    });

    // Test Case 7: Missing colon after key (error case)
    it.skip('should report an error for a missing colon after a key', () => {
        const markdown = `
M:1
Task "Missing Colon" "Desc" "M"
    Notes
        - Some note
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].name).toBe('Missing Colon');
        expect(result.tasks[0].details).toEqual({});
        console.log(JSON.stringify(result.errors, null, 2));
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Malformed task detail key: "Notes"'),
            line: 3,
        }));
    });

    // Test Case 8: Additional task details with inline comments
    it.skip('should ignore comments within task detail lines', () => {
        const markdown = `
M:1
Task "Commented Details" "Desc" "M"
    Assumptions: # These are assumptions
        - First assumption // Inline comment here
        - Second assumption
    Metadata:
        - Key: Value # Another comment
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        const task = result.tasks[0];
        console.log(JSON.stringify(task, null, 2))
        expect(task.name).toBe('Commented Details');
        expect(task.details).toEqual({
            Assumptions: ['First assumption', 'Second assumption'],
            Metadata: ['Key: Value'],
        });
        expect(result.errors).toHaveLength(0);
    });

    // Test Case 9: Task details following an explicit dependency
    it('should parse task details correctly when preceded by an explicit dependency statement', () => {
        const markdown = `
M:1
L:10
Task "Setup Environment" "Desc" "M" 
"Setup Environment" should happen before "Develop Backend"
Task "Develop Backend" "Initial setup" "L"
    Assumptions:
        - Node.js is installed.
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0].name).toBe('Setup Environment');
        expect(result.tasks[1].name).toBe('Develop Backend');
        expect(result.tasks[1].details).toEqual({
            Assumptions: ['Node.js is installed.'],
        });
        expect(result.dependencies).toHaveLength(1);
        expect(result.dependencies[0]).toEqual({ source: 'Setup Environment', target: 'Develop Backend' });
        console.log(JSON.stringify(result.errors, null, 2))
        expect(result.errors).toHaveLength(0);
    });

    // Test Case 10: Task details with mixed indentation (tab and spaces) - should fail if not consistent
    it.skip('should report error for mixed indentation (tabs and spaces) if parser enforces consistency', () => {
        const markdown = `
M:1
Task "Mixed Indent Task" "Desc" "M"
    Assumptions:
\t- Tab indented bullet
    - Space indented bullet // This will cause inconsistency if parser is strict
`;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].name).toBe('Mixed Indent Task');
        // Depending on parser implementation, this might result in an error or partial parsing
        // Assuming strictness based on "Consistent indentation will be crucial for parsing"
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('Inconsistent or incorrect indentation for task detail value'),
            line: 5, // Or line 4 if it detects tab vs spaces immediately
        }));
    });

});

describe('parseMarkdown - New PRD Features (Timeline & Scheduling)', () => {

    it('should parse a global Start Date directive', () => {
        const markdown = `
        Start Date: 2025-06-01
        Task "A" "" "L"
        L:10
        `;
        const result = parseMarkdown(markdown);
        console.log(result);
        expect(result.startDate).toBe('2025-06-01');
        expect(result.errors).toHaveLength(0);
    });

    it('should parse an inline start date in a Task definition', () => {
        const markdown = `
        Task "A" "" "L" start: 2025-06-05
        L:10
        `;
        const result = parseMarkdown(markdown);
        console.log(result);
        expect(result.tasks[0].name).toBe('A');
        expect(result.tasks[0].startDate).toBe('2025-06-05');
        expect(result.errors).toHaveLength(0);
    });

    it('should parse an inline start date in a Task definition when its in double quotes', () => {
        const markdown = `
        Task "A" "" "L" start: "2025-06-05"
        L:10
        `;
        const result = parseMarkdown(markdown);
        console.log(result);
        expect(result.tasks[0].name).toBe('A');
        expect(result.tasks[0].startDate).toBe('2025-06-05');
        expect(result.errors).toHaveLength(0);
    });

    it.skip('should parse an inline start date in a Task definition when its in sinlge quotes', () => {
        const markdown = `
        Task "A" "" "L" start: '2025-06-05'
        L:10
        `;
        const result = parseMarkdown(markdown);
        console.log(result);
        expect(result.tasks[0].name).toBe('A');
        expect(result.tasks[0].startDate).toBe('2025-06-05');
        expect(result.errors).toHaveLength(0);
    });

    it('should parse an inline start date in a Task Group definition', () => {
        const markdown = `
        Task "A" "" "L"
        Task Group "Group 1" ["A"] bandwidth: 1 start: 2025-06-10
        L:10
        `;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0].name).toBe('Group 1');
        expect(result.taskGroups[0].startDate).toBe('2025-06-10');
        expect(result.errors).toHaveLength(0);
    });

    it('should parse a Work Days directive', () => {
        const markdown = `
        Work Days: Mon, Tue, Wed
        `;
        const result = parseMarkdown(markdown);
        expect(result.workDays).toEqual(['Mon', 'Tue', 'Wed']);
        expect(result.errors).toHaveLength(0);
    });

    // ADD THIS NEW TEST to verify the new, flexible behavior.
    it('should parse a Work Days directive with full day names correctly', () => {
        const markdown = `
    Work Days: Monday, Tuesday, Wednesday
    `;
        const result = parseMarkdown(markdown);
        expect(result.workDays).toEqual(['Mon', 'Tue', 'Wed']); // Expects standardized output
        expect(result.errors).toHaveLength(0);
    });

    it('should handle a truly malformed Work Days directive with an error', () => {
        const markdown = `
    Work Days: ABC, XYZ
    `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Unrecognized or malformed line syntax: "Work Days: ABC, XYZ"');
    });

    it('should parse a Holidays directive with multiple dates', () => {
        const markdown = `
        Holidays: 2025-12-25, 2026-01-01
        `;
        const result = parseMarkdown(markdown);
        expect(result.holidays).toEqual(['2025-12-25', '2026-01-01']);
        expect(result.errors).toHaveLength(0);
    });

    it('should parse a Duration Mode directive', () => {
        const markdown = `
        Duration Mode: elapsed
        `;
        const result = parseMarkdown(markdown);
        expect(result.durationMode).toBe('elapsed');
        expect(result.errors).toHaveLength(0);
    });

    it('should handle an invalid Duration Mode with an error', () => {
        const markdown = `
        Duration Mode: invalid
        `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Unrecognized or malformed line syntax: "Duration Mode: invalid"');
    });

    it('should parse a Non-working Day Color directive', () => {
        const markdown = `
        Non-working Day Color: #334155
        `;
        const result = parseMarkdown(markdown);
        console.log(result)
        expect(result.nonWorkingDayColor).toBe('#334155');
        expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple top-level directives correctly', () => {
        const markdown = `
        Start Date: 2025-07-01
        Work Days: Mon, Tue, Wed, Thu, Fri
        Holidays: 2025-07-04
        Duration Mode: working
        Non-working Day Color: #f0f0f0
        Task "A" "" "L"
        L:10
        `;
        const result = parseMarkdown(markdown);
        expect(result.startDate).toBe('2025-07-01');
        expect(result.workDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        expect(result.holidays).toEqual(['2025-07-04']);
        expect(result.durationMode).toBe('working');
        expect(result.nonWorkingDayColor).toBe('#f0f0f0');
        expect(result.errors).toHaveLength(0);
    });

    it('should handle a task with both inline dependencies and an inline start date', () => {
        const markdown = `
        Task "A" "" "S"
        Task "B" "" "L" "A" start: 2025-08-10
        L:10
        S:5
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[1].name).toBe('B');
        expect(result.tasks[1].dependencies).toEqual(['A']);
        expect(result.tasks[1].startDate).toBe('2025-08-10');
        expect(result.errors).toHaveLength(0);
    });
});