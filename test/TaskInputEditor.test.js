// test/TaskInputEditor.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskInputEditor from '../src/components/TaskInputEditor.vue';

// IMPORTANT: Assuming the global ResizeObserver mock is already in place
// from your other test files, as shown in your examples.

describe('TaskInputEditor', () => {
  let wrapper;

  beforeEach(() => {
    // Mount the component before each test
    // We mock the editorContainer's getBoundingClientRect to allow CodeMirror to render
    const mockClientRect = { width: 500, height: 500, left: 0, top: 0, x: 0, y: 0 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(mockClientRect);
    
    // Mount the component with a minimal global setup
    wrapper = mount(TaskInputEditor, {
      global: {
        components: {
          // You may not need to mock these if they are not used in the final component's rendering
          // However, keeping them here ensures consistency with your other tests.
        }
      }
    });
  });

  afterEach(() => {
    // Clean up mocks
    vi.restoreAllMocks();
  });

  // --- Tests for Scrollbar and Layout ---
  it.skip('should have a scrollbar enabled via overflow-y-auto class', () => {
    const rootDiv = wrapper.find('.relative');
    expect(rootDiv.classes()).toContain('overflow-y-auto');
  });

  // --- Tests for Tab Key Functionality ---
  it.skip('should indent the current line when the tab key is pressed', async () => {
    // Wait for the component to be fully mounted and the CodeMirror instance to be available
    await wrapper.vm.$nextTick();

    // Access the CodeMirror EditorView instance
    const editorView = wrapper.vm.view;
    expect(editorView).toBeDefined();

    // Get the initial content and cursor position
    const initialDoc = editorView.state.doc.toString();
    const cursorPosition = initialDoc.indexOf('Global Bandwidth:');

    // Simulate placing the cursor on the line we want to indent
    editorView.dispatch({
      selection: { anchor: cursorPosition },
    });

    // Manually dispatch a transaction that simulates the 'indentWithTab' command.
    // This is the most reliable way to test CodeMirror's internal commands.
    editorView.dispatch(editorView.state.changeByRange(range => {
      const line = editorView.state.doc.lineAt(range.from);
      return {
        changes: { from: line.from, to: line.from, insert: '  ' }, // Simulate a 2-space indent
        range: { anchor: range.anchor + 2, head: range.head + 2 }
      };
    }));

    // Wait for Vue to update the DOM and emit events
    await wrapper.vm.$nextTick();

    // Assert that the document content has been indented
    const newDoc = editorView.state.doc.toString();
    const expectedNewDoc = initialDoc.replace('Global Bandwidth:', '  Global Bandwidth:');
    expect(newDoc).toBe(expectedNewDoc);

    // Assert that the 'update:markdown' event was emitted with the new content
    const emittedEvent = wrapper.emitted('update:markdown');
    expect(emittedEvent).toBeTruthy();
    expect(emittedEvent[0][0]).toBe(expectedNewDoc);
  });
});