// test/myCompletion.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { autocompletion, startCompletion, CompletionContext } from '@codemirror/autocomplete'; 

import { myCompletion, setAvailableTaskNamesForCompletion, SIMPLIFIED_TASK_SNIPPET, predefinedDurationLabels } from '../src/utils/completionProvider.js';

// Mock EditorView and startCompletion for testing apply functions
let mockView;
vi.mock('@codemirror/autocomplete', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        startCompletion: vi.fn(), // Mock startCompletion
    };
});

describe('myCompletion', () => {
    // Setup before each test
    beforeEach(() => {
        // Reset available task names
        setAvailableTaskNamesForCompletion(['Develop UI', 'Code Backend', 'Write Docs', 'Deploy Backend', 'Test Integration']);
        // Reset mock for startCompletion
        startCompletion.mockClear();

        // Create a basic mock EditorView with a dispatch method
        mockView = {
            state: EditorState.create({ doc: '' }), // Minimal state
            dispatch: vi.fn(),
            // Ensure `view` in `apply` functions has a `state` property with `replace` or `changes`
            // For now, `dispatch` will capture changes.
        };
        // Provide EditorView.prototype.dispatch as a mock implementation for apply tests
        // This is tricky, a full mock of EditorView can be complex.
        // For 'apply' tests, we'll manually check what dispatch receives.
    });

    /**
     * Helper to create a CodeMirror CompletionContext for testing.
     * @param {string} docText - The full document text.
     * @param {number} cursorOffset - The cursor position (offset from start of document).
     * @returns {CompletionContext} A mock CompletionContext.
     */
    const createContext = (docText, cursorOffset) => {
        const state = EditorState.create({
            doc: docText,
            selection: EditorSelection.cursor(cursorOffset),
            extensions: [
                autocompletion({ override: [myCompletion] }) // Add autocompletion extension
            ]
        });
        const view = new EditorView({ state }); // Create a real EditorView to get proper context
        const context = new CompletionContext(view.state, cursorOffset, true);
        
        // Mock context.matchBefore and other methods that myCompletion uses
        context.matchBefore = (regexp) => {
            const text = docText.substring(0, cursorOffset);
            const match = text.match(regexp);
            if (match) {
                return {
                    from: cursorOffset - match[0].length,
                    to: cursorOffset,
                    text: match[0],
                    groups: match.groups // Ensure groups are passed if captured
                };
            }
            return null;
        };

        // Mock context.state.doc.lineAt for line specific operations
        context.state.doc.lineAt = (pos) => {
            const lines = docText.split('\n');
            let currentLine = 0;
            let currentOffset = 0;
            for (let i = 0; i < lines.length; i++) {
                if (cursorOffset >= currentOffset && cursorOffset <= currentOffset + lines[i].length) {
                    currentLine = i + 1;
                    return {
                        number: currentLine,
                        from: currentOffset,
                        to: currentOffset + lines[i].length,
                        text: lines[i]
                    };
                }
                currentOffset += lines[i].length + 1; // +1 for newline character
            }
            // Fallback for end of document or empty doc
            return { number: lines.length, from: docText.length, to: docText.length, text: '' };
        };

        return context;
    };

    // --- Test Cases ---

    describe('Task (definition) snippet', () => {
        it('should suggest "Task (definition)" when "T" is typed at line start', () => {
            const context = createContext('T', 1);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options).toHaveLength(1);
            expect(result.options[0].label).toBe('Task (definition)');
            expect(result.from).toBe(0); // Should replace from start of 'T'
            expect(result.options[0].apply).toBe(SIMPLIFIED_TASK_SNIPPET);
        });

        it('should suggest "Task (definition)" when "Ta" is typed at line start', () => {
            const context = createContext('Ta', 2);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options[0].label).toBe('Task (definition)');
            expect(result.from).toBe(0);
        });

        it('should suggest "Task (definition)" when "Task" is typed at line start', () => {
            const context = createContext('Task', 4);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options[0].label).toBe('Task (definition)');
            expect(result.from).toBe(0);
        });

        it('should suggest "Task (definition)" when "task" (lowercase) is typed at line start', () => {
            const context = createContext('task', 4);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options[0].label).toBe('Task (definition)');
            expect(result.from).toBe(0);
        });

        it('should suggest "Task (definition)" when "Task" is typed with leading spaces', () => {
            const context = createContext('  Task', 6);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options[0].label).toBe('Task (definition)');
            expect(result.from).toBe(2); // Should replace from 'T' after spaces
        });

        it('should NOT suggest "Task (definition)" if "Task" is in the middle of a word', () => {
            const context = createContext('MyTask', 6);
            const result = myCompletion(context);
            expect(result).toBeNull();
        });

        it('should NOT suggest "Task (definition)" if it is not at the start of the line', () => {
            const context = createContext('  Test Task', 11);
            const result = myCompletion(context);
            expect(result).toBeNull();
        });
    });

    describe('Dependency/Task Name Autocomplete', () => {
        beforeEach(() => {
            setAvailableTaskNamesForCompletion(['Develop UI', 'Code Backend', 'Write Docs', 'Deploy Backend']);
        });

        it('should suggest task names inside empty dependency quotes', () => {
            const doc = `Task "A" "B" "M" ""`;
            const context = createContext(doc, doc.length - 1); // Cursor at "
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toContain('Develop UI');
            expect(result.from).toBe(doc.length - 1); // Should replace from after "
        });

        it('should filter task names when typing inside dependency quotes', () => {
            const doc = `Task "A" "B" "M" "Code"`;
            const context = createContext(doc, doc.length - 1); // Cursor at "Code|"
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(['Code Backend']);
            expect(result.from).toBe(doc.length - 5); // Should replace 'Code'
        });

        it('should suggest task names after a comma in dependency quotes', () => {
            const doc = `Task "A" "B" "M" "Develop UI, C"`;
            const context = createContext(doc, doc.length - 1); // Cursor at "Develop UI, C|"
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(['Code Backend']);
            expect(result.from).toBe(doc.length - 2); // Should replace 'C'
        });

        it('should trigger startCompletion after applying a dependency', () => {
            const doc = `Task "A" "B" "M" "Code"`;
            const context = createContext(doc, doc.length - 1);
            const result = myCompletion(context);
            const applyFn = result.options[0].apply; // Get the apply function for 'Code Backend'

            // Mock view state for apply function test
            const viewWithMockDispatch = {
                state: EditorState.create({ doc: doc, selection: EditorSelection.cursor(context.pos) }),
                dispatch: vi.fn(),
            };
            
            applyFn(viewWithMockDispatch, result.options[0], result.from, context.pos);

            expect(viewWithMockDispatch.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    changes: {
                        from: expect.any(Number),
                        to: expect.any(Number),
                        insert: 'Code Backend'
                    }
                })
            );
            expect(startCompletion).toHaveBeenCalledWith(viewWithMockDispatch);
        });
        
        it('should suggest task names for explicit depends on syntax', () => {
            const doc = `"Task B" depends on "De"`;
            const context = createContext(doc, doc.length - 1); // Cursor at "De|"
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toContain('Develop UI');
            expect(result.from).toBe(doc.length - 3); // Should replace 'De'
        });
    });

    describe('Duration Labels Autocomplete', () => {
        it('should suggest duration labels inside quotes in duration field', () => {
            const doc = `Task "Name" "Desc" "X"`;
            const context = createContext(doc, doc.length - 1); // Cursor at "X|"
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(['XS', 'XL', 'XXL']); // Filtered by 'X'
            expect(result.from).toBe(doc.length - 2); // Should replace 'X'
        });

        it.skip('should suggest all duration labels inside empty quotes in duration field', () => {
            // TODO come back to this
            const doc = `Task "Name" "Desc" ""`;
            const context = createContext(doc, doc.length - 1); // Cursor at "|
            const result = myCompletion(context);
            console.log("Result is", result)
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(predefinedDurationLabels);
            expect(result.from).toBe(doc.length - 1); // Should replace from after "
        });
    });

    describe('Global Bandwidth Autocomplete', () => {
        it('should suggest "unbound" and numbers when typing "Global Bandwidth: u"', () => {
            const doc = `Global Bandwidth: u`;
            const context = createContext(doc, doc.length); // Cursor after 'u'
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(['"unbound"']);
            expect(result.from).toBe(doc.length - 1); // Should replace 'u'
        });

        it('should suggest numbers when typing "Global Bandwidth: 2"', () => {
            const doc = `Global Bandwidth: 2`;
            const context = createContext(doc, doc.length);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(['2']);
            expect(result.from).toBe(doc.length - 1);
        });

        it.skip('should suggest "unbound" and numbers when typing "Global Bandwi"', () => {
            const doc = `Global Bandwi`;
            const context = createContext(doc, doc.length);
            const result = myCompletion(context);
            expect(result).not.toBeNull();
            expect(result.options.map(o => o.label)).toEqual(['"unbound"', '1', '2', '3', '4', '5']);
            expect(result.from).toBe(doc.length - 7); // Replaces 'Bandwi' part
        });
    });
});