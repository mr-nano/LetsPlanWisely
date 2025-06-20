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
import { autocompletion, CompletionContext } from '@codemirror/autocomplete'; // CompletionContext is a type, not a runtime value, but sometimes helps with type checking
import { lintGutter, linter, setDiagnostics } from '@codemirror/lint';
// Custom syntax highlighting is currently disabled as per previous commit.
// import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
// import { tags } from '@lezer/highlight';

// --- PROPS & EMITS ---
const emit = defineEmits(['update:markdown']);

// --- REFS ---
const editorContainer = ref(null);
let view = null; // CodeMirror EditorView instance
let availableTaskNames = []; // Task names for autocomplete
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

// --- CodeMirror Extensions (Custom Highlighting is REMOVED/COMMENTED OUT for now) ---

// Autocomplete Source
const predefinedDurationLabels = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// New: Snippet for Task definition
const taskSnippet = `Task "$NAME$" "$DESCRIPTION$" "$DURATION$" "$DEPENDENCIES$"`; // Use placeholders
// Define the completion effect for a snippet
import { snippetCompletion } from "@codemirror/autocomplete"; // REMOVE 'syntaxTree'

const myCompletion = (context) => {
  const word = context.matchBefore(/\w*/); // Match any word characters
  if (!word.from) return null; // No word to complete

  const line = context.state.doc.lineAt(context.pos);
  const lineText = line.text;
  const lineBeforeCursor = lineText.substring(0, context.pos - line.from);

  let options = [];

  // --- Context-Specific Autocomplete Logic ---

  // 1. Suggest 'Task' snippet if at the start of a line or after a blank line
  if (lineBeforeCursor.trim() === 'Task' && lineBeforeCursor.length === 'Task'.length) {
    return {
      from: word.from,
      options: [
        snippetCompletion(taskSnippet, {
          label: "Task (full definition)",
          info: "Define a new task with name, description, duration, and dependencies.",
          type: "keyword"
        })
      ]
    };
  }


  // 2. Autocomplete for Task Names (inside quotes)
  // Check if cursor is inside a quoted string. This is a heuristic.
  const regexInQuote = /"[^"]*$/; // Matches an open quote followed by any non-quote chars to end of string
  const matchInQuote = lineBeforeCursor.match(regexInQuote);

  if (matchInQuote) {
    const textInQuote = matchInQuote[0].substring(1); // Get content after the opening quote
    options = availableTaskNames
      .filter(name => typeof name === 'string' && name.length > 0 && name.toLowerCase().startsWith(textInQuote.toLowerCase()))
      .map(name => ({ label: name, type: 'variable', apply: `"${name}"` })); // Apply with quotes for seamless replacement
      // If we are inside an already existing quoted string (e.g. "Task "My Task" "Desc" "Dur" "Depen^cies""),
      // the `apply` will be crucial to replace just the portion inside quotes.
      // `apply` can also be a function, but for simple strings, it replaces `word.text`.
      // We will adjust the `from` property to ensure the replacement covers the text *inside* the quotes.
    const quoteStartPos = line.from + lineBeforeCursor.lastIndexOf('"') + 1;
    return {
      from: quoteStartPos, // Start completion from after the opening quote
      options: options,
      validFor: /[^"]*/ // Valid for any character until a closing quote
    };
  }


  // 3. Autocomplete for Duration Labels
  // Check if it's a "Task ... " duration field
  // This regex targets the *last* quoted string field in a "Task" definition that's incomplete
  const taskDurationMatch = lineBeforeCursor.match(/^Task\s+"[^"]*"(?:\s+"[^"]*")?\s+"(\w*)$/);
  if (taskDurationMatch) {
    const potentialDuration = taskDurationMatch[1]; // What the user has typed for duration
    options = predefinedDurationLabels
      .filter(label => label.toLowerCase().startsWith(potentialDuration.toLowerCase()))
      .map(label => ({ label: label, type: 'keyword' }));

    return {
      from: line.from + lineBeforeCursor.lastIndexOf('"') + 1 + potentialDuration.length - word.text.length, // Adjust 'from' for duration
      options: options,
      validFor: /\w*/ // Valid for word characters
    };
  }

  // Default: no completion
  return null;
};


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
        // customLanguageSupport, // STILL DISABLED
        autocompletion({ override: [myCompletion] }),
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

onUnmounted(() => { // Corrected: onUnmounted
  if (view) {
    view.destroy();
  }
});

// --- EXPOSED METHODS ---
const setAvailableTaskNames = (names) => {
  availableTaskNames = Array.isArray(names) ? names.filter(name => typeof name === 'string' && name.length > 0) : [];
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
        from = 0; // Fallback to start
        to = view.state.doc.length; // Fallback to end
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
  font-family: monospace; /* Ensure monospace font */
  font-size: 0.875rem; /* Equivalent to text-sm (14px) */
  line-height: 1.5; /* Equivalent to leading-relaxed */
}
/* Style for autocomplete popup */
.cm-tooltip-autocomplete {
  background-color: white;
  border: 1px solid #e2e8f0; /* gray-300 */
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* shadow-lg */
  border-radius: 0.375rem; /* rounded-md */
  max-height: 12rem; /* max-h-48 */
  overflow-y: auto;
  z-index: 100; /* Ensure it's above other elements */
}
.cm-completionLabel {
  padding: 0.5rem 0.75rem; /* p-2 */
  cursor: pointer;
  font-size: 0.875rem; /* text-sm */
}
.cm-active.cm-completionLabel {
  background-color: #3b82f6; /* blue-500 */
  color: white;
}
.cm-tooltip-autocomplete > ul > li:hover:not(.cm-active) {
  background-color: #eff6ff; /* blue-100 */
}
/* Style for lint gutter icons */
.cm-lint-marker-error {
  color: #ef4444; /* red-500 */
}
.cm-lint-marker-warning {
  color: #f59e0b; /* yellow-500 */
}
</style>