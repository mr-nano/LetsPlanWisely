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
        Task Group ["Task A", "Task B"] bandwidth: 3
        M:5
        `;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'list',
            identifiers: ['Task A', 'Task B'],
            bandwidth: 3,
        });
        expect(result.errors).toHaveLength(0);
    });

    it('should parse task group by regex', () => {
        const markdown = `Task Group /backend-*/ bandwidth: "unbound"`;
        const result = parseMarkdown(markdown);
        expect(result.taskGroups).toHaveLength(1);
        expect(result.taskGroups[0]).toEqual({
            type: 'regex',
            identifiers: ['backend-*'],
            bandwidth: 'unbound',
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

    it('should ignore lines starting with // or # as comments', () => {
        const markdown = `
        // This is a comment
        Task "A" "" "L"
        # Another comment
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
            line: 3 // Expecting line number 3 based on input
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

        Task Group ["Develop UI", "Code Backend"] bandwidth: 1
        `;
        const result = parseMarkdown(markdown);

        console.log("Results logs", JSON.stringify(result, null, 2));

        expect(result.tasks).toHaveLength(3);
        expect(result.durationLabels).toEqual({ L: 10, M: 5, S: 2, XL: 15 });
        expect(result.globalBandwidth).toBe(2);
        expect(result.taskGroups).toHaveLength(1);
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
        const markdown = `Task "SelfDep" "Desc" "M" "SelfDep"`;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(expect.objectContaining({
            type: 'error',
            message: expect.stringContaining('cannot depend on itself'),
        }));
    });

    it('should validate all referenced tasks in dependencies', () => {
        const markdown = `
        Task "A" "" "M" "NonExistent"
        "NonExistent2" should happen before "A"
        `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].message).toContain('Dependency source task "NonExistent" is not defined.');
        expect(result.errors[1].message).toContain('Dependency source task "NonExistent2" is not defined.');
    });

    it('should validate task group identifiers', () => {
        const markdown = `
        Task "ExistingTask" "" "M"
        Task Group [ExistingTask, "NonExistentTask"] bandwidth: 1
        `;
        const result = parseMarkdown(markdown);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Task Group references undefined task "NonExistentTask"');
    });

    it('should handle blank lines correctly', () => {
        const markdown = `
        Task "A" "Desc" "M"

        Task "B" "Desc" "M"
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
    });

    it('should parse comments at the end of a line', () => {
        const markdown = `
        Task "Task A" "Desc" "M" # This is a comment
        L:10 // Another comment
        `;
        const result = parseMarkdown(markdown);
        expect(result.tasks).toHaveLength(1);
        expect(result.durationLabels).toEqual({ L: 10 });
        expect(result.errors).toHaveLength(0);
    });
});

