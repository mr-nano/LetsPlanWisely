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
import { autocompletion } from '@codemirror/autocomplete';
import { lintGutter, linter, setDiagnostics } from '@codemirror/lint'; // <--- Ensure 'linter' is here
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// --- PROPS & EMITS ---
const emit = defineEmits(['update:markdown']); // No longer needs 'request:taskNames' directly

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

// --- CodeMirror Extensions ---

// 1. Custom Syntax Highlighting (Simplified Example)
// This will just highlight "Task", "Global Bandwidth", "Task Group", and quotes.
// A more advanced tokenizer could be built using `@codemirror/language`'s StreamLanguage
// or Lezer parser for full grammar parsing. For now, this highlights keywords.
const myHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#9d52d9' }, // Purple for keywords
  { tag: tags.string, color: '#32a852' },  // Green for strings (quoted text)
  { tag: tags.number, color: '#eb872a' }, // Orange for numbers
  { tag: tags.comment, color: '#888888', fontStyle: 'italic' }, // Gray for comments
]);

const customLanguageSupport = [
  syntaxHighlighting(myHighlightStyle),
  EditorState.transactionExtender.of(tr => {
    if (tr.docChanged) {
      // Basic detection for highlighting keywords
      const doc = tr.newDoc;
      const changes = [];
      const keywords = ["Task", "Global Bandwidth", "Task Group", "bandwidth", "unbound", "depends on", "should happen before", "should happen after"];
      const durationLabels = ["XS", "S", "M", "L", "XL", "XXL"];

      doc.iterLines(line => {
        const lineText = line.text;
        keywords.forEach(keyword => {
          let lastIndex = -1;
          while ((lastIndex = lineText.indexOf(keyword, lastIndex + 1)) !== -1) {
            changes.push({ from: line.from + lastIndex, to: line.from + lastIndex + keyword.length, type: tags.keyword });
          }
        });
        durationLabels.forEach(label => {
            let lastIndex = -1;
            while ((lastIndex = lineText.indexOf(label, lastIndex + 1)) !== -1) {
                // Check if it's likely a standalone label (e.g., 'S') and not part of another word
                if ((lastIndex === 0 || /\s/.test(lineText[lastIndex - 1])) &&
                    (lastIndex + label.length === lineText.length || /\s/.test(lineText[lastIndex + label.length]) || lineText[lastIndex + label.length] === ':')) {
                    changes.push({ from: line.from + lastIndex, to: line.from + lastIndex + label.length, type: tags.keyword }); // Or a custom tag for duration labels
                }
            }
        });
        // Highlight quoted strings
        const stringMatches = lineText.matchAll(/"([^"]*)"/g);
        for (const match of stringMatches) {
            changes.push({ from: line.from + match.index, to: line.from + match.index + match[0].length, type: tags.string });
        }
        // Highlight comments
        let commentIndex = lineText.indexOf('//');
        if (commentIndex === -1) commentIndex = lineText.indexOf('#');
        if (commentIndex !== -1) {
            changes.push({ from: line.from + commentIndex, to: line.from + lineText.length, type: tags.comment });
        }
      });
      return EditorState.changeByRange(changes);
    }
    return null;
  })
];


// 2. Autocomplete Source
const predefinedDurationLabels = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// TaskInputEditor.vue, around line 63
const myCompletion = (context) => {
  let word = context.matchBefore(/[\w"]*/);
  if (!word || !word.from && word.from !== 0) return null; // Ensure word is valid. `word.from` can be 0.

  const line = context.state.doc.lineAt(context.pos).text;
  const lineBefore = line.substring(0, context.pos - context.state.doc.lineAt(context.pos).from);

  let options = [];

  const openQuoteIndex = lineBefore.lastIndexOf('"');
  const closeQuoteIndex = lineBefore.indexOf('"', openQuoteIndex + 1);
  const isInsideQuote = openQuoteIndex !== -1 && (closeQuoteIndex === -1 || context.pos <= closeQuoteIndex + context.state.doc.lineAt(context.pos).from);

  if (isInsideQuote) {
    // Ensure `availableTaskNames` contains only strings before mapping
    options = availableTaskNames
      .filter(name => typeof name === 'string' && name.length > 0) // <--- Add this filter here
      .map(name => ({ label: name, type: 'variable' }));
  } else {
    const taskDurationMatch = lineBefore.match(/^Task\s+"[^"]*"(?:\s+"[^"]*")?\s+"(\w*)$/);
    if (taskDurationMatch) {
      // predefinedDurationLabels are constants, so they should be fine, but filter anyway for consistency
      options = predefinedDurationLabels
        .filter(label => typeof label === 'string' && label.length > 0) // <--- Add this filter here
        .map(label => ({ label: label, type: 'keyword' }));
    }
  }

  // This is line 63:
  const filteredOptions = options.filter(option =>
    // Ensure option and option.label are not undefined before calling toLowerCase()
    option && typeof option.label === 'string' && option.label.toLowerCase().startsWith(word.text.toLowerCase())
  );

  return {
    from: word.from,
    options: filteredOptions,
    validFor: /[\w"]*/,
  };
};


// 3. Linting Source (for displaying errors from App.vue)
let currentDiagnostics = [];
const lintSource = (view) => {
  return currentDiagnostics.map(diag => ({
    from: diag.from || 0, // Placeholder, ideally parser would give precise range
    to: diag.to || diag.from || view.state.doc.length, // Placeholder
    severity: diag.type, // 'error' or 'warning'
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
//        customLanguageSupport,
        autocompletion({ override: [myCompletion] }),
        lintGutter(), // This provides the gutter visuals
        linterCompartment.of(linter(lintSource)), // <--- This is the crucial change
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
// Method to set available task names from parent (App.vue)
// Method to receive task names from the parent
// TaskInputEditor.vue
// Method to receive task names from the parent
const setAvailableTaskNames = (names) => {
  // Ensure names is an array and filter out any non-string or empty values
  availableTaskNames = Array.isArray(names) ? names.filter(name => typeof name === 'string' && name.length > 0) : [];
};

// Method to update linting diagnostics from parent (App.vue)
const setLintDiagnostics = (errors) => {
  currentDiagnostics = errors.map(err => {
    let from = 0;
    let to = view ? view.state.doc.length : 0;

    if (err.line !== 'N/A' && view) {
      try {
        const lineObj = view.state.doc.line(err.line);
        from = lineObj.from;
        to = lineObj.to;
      } catch (e) {
        // Fallback if line number is out of bounds or other issue
        from = 0;
        to = view.state.doc.length;
      }
    }

    return {
      from: from,
      to: to,
      severity: err.type, // 'error' or 'warning'
      message: err.message,
    };
  });

  if (view) {
    // This is where we dispatch an update to the linter extension's field
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