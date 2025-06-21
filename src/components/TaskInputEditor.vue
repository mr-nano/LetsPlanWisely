<template>
  <div class="relative flex flex-col h-full border border-gray-300 rounded overflow-hidden">
    <div ref="editorContainer" class="flex-grow"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, defineEmits, defineExpose } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from '@codemirror/basic-setup';
import { autocompletion } from '@codemirror/autocomplete'; // Only autocompletion here
import { lintGutter, linter, setDiagnostics } from '@codemirror/lint';

// Import from our new completionProvider module
import { myCompletion, setAvailableTaskNamesForCompletion } from '../utils/completionProvider.js';

// --- PROPS & EMITS ---
const emit = defineEmits(['update:markdown']);

// --- REFS ---
const editorContainer = ref(null);
let view = null; // CodeMirror EditorView instance
const linterCompartment = new Compartment(); // To update linting diagnostics dynamically

// Initial content for the editor
const initialMarkdown = `Task "Develop UI" "Implement frontend" "M" "Code Backend"
Task "Code Backend" "Develop API and DB" "L"
Task "Write Docs" "Prepare user documentation" "S" "Develop UI"
Task "Deploy Backend" "Set up server infrastructure" "XL" "Code Backend"
Task "Test Integration" "Ensure systems work together" "M" "Develop UI, Deploy Backend"

Global Bandwidth: 2
L:10
M:5
S:2
XL:15
`;

// --- CodeMirror Extensions ---

// Linting Source (for displaying errors from App.vue)
let currentDiagnostics = [];
const lintSource = (view) => {
  return currentDiagnostics.map(diag => ({
    from: diag.from || 0,
    to: diag.to || diag.from || view.state.doc.length,
    severity: diag.type,
    message: diag.message,
  }));
};

// --- LIFECYCLE HOOKS ---
onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: initialMarkdown,
      extensions: [
        basicSetup,
        autocompletion({ override: [myCompletion] }), // Use imported myCompletion
        lintGutter(),
        linterCompartment.of(linter(lintSource)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emit('update:markdown', update.state.doc.toString());
          }
        }),
      ],
    }),
    parent: editorContainer.value,
  });
});

onUnmounted(() => {
  if (view) {
    view.destroy();
  }
});

// --- EXPOSED METHODS ---
// This now calls the exported function from completionProvider.js
const setAvailableTaskNames = (names) => {
  setAvailableTaskNamesForCompletion(names);
};

const setLintDiagnostics = (errors) => {
  currentDiagnostics = errors.map(err => {
    let from = 0;
    let to = view ? view.state.doc.length : 0;

    if (err.line !== 'N/A' && view && err.line >= 1 && err.line <= view.state.doc.lines) {
      try {
        const lineObj = view.state.doc.line(err.line);
        from = lineObj.from;
        to = lineObj.to;
      } catch (e) {
        console.warn("Could not map error line to CodeMirror range:", err, e);
        from = 0;
        to = view.state.doc.length;
      }
    }

    return {
      from: from,
      to: to,
      severity: err.type,
      message: err.message,
    };
  });

  if (view) {
    view.dispatch({
      effects: linterCompartment.reconfigure(linter(lintSource))
    });
  }
};

defineExpose({
  setAvailableTaskNames,
  setLintDiagnostics,
});
</script>

<style scoped>
/* Basic styling for CodeMirror to fit the container */
.cm-editor {
  height: 100%;
}
/* Adjust CodeMirror's default font size if needed for consistency */
.cm-editor .cm-line {
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}
/* Style for autocomplete popup */
.cm-tooltip-autocomplete {
  background-color: white;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 0.375rem;
  max-height: 12rem;
  overflow-y: auto;
  z-index: 100;
}
.cm-completionLabel {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
}
.cm-active.cm-completionLabel {
  background-color: #3b82f6;
  color: white;
}
.cm-tooltip-autocomplete > ul > li:hover:not(.cm-active) {
  background-color: #eff6ff;
}
/* Style for lint gutter icons */
.cm-lint-marker-error {
  color: #ef4444;
}
.cm-lint-marker-warning {
  color: #f59e0b;
}
</style>