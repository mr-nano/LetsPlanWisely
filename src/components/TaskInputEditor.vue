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
// Only import what's directly needed for the autocompletion *logic*
import { autocompletion, CompletionContext, snippetCompletion, startCompletion } from '@codemirror/autocomplete';
import { lintGutter, linter, setDiagnostics } from '@codemirror/lint';

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

// --- CodeMirror Extensions ---

// Autocomplete Source
const predefinedDurationLabels = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// New: Simpler Task definition snippet string
const SIMPLIFIED_TASK_SNIPPET = `Task "Task Name" "Optional Description" "Duration" "Optional list of dependent tasks"`;

const myCompletion = (context) => {
 console.log('--- Autocomplete Check ---');
  console.log('Cursor pos:', context.pos);
  const line = context.state.doc.lineAt(context.pos);
  const lineText = line.text;
  const lineBeforeCursor = lineText.substring(0, context.pos - line.from);
  const trimmedLineBeforeCursor = lineBeforeCursor.trimStart();
  console.log('Line before cursor:', lineBeforeCursor);
  console.log('Trimmed line before cursor:', trimmedLineBeforeCursor);

  let options = [];

  // --- Context-Specific Autocomplete Logic ---

  // Change this line:
// const taskPrefixMatch = context.matchBefore(/^\s*(task\w*)$/i);
// To something like this:
const taskPrefixMatch = context.matchBefore(/^\s*(t(?:a(?:s(?:k)?)?)?)$/i); // Matches t, ta, tas, task

// Or a simpler, more robust way if context.matchBefore works by matching a word:
const typedWordMatch = context.matchBefore(/\w*$/); // Matches any word characters before the cursor
if (typedWordMatch && typedWordMatch.text.length > 0) {
    const typedWord = typedWordMatch.text;
    const lineStartTrimmedText = lineBeforeCursor.trimStart();

    // Check if the typed word (e.g., "t", "ta", "tas", "task") starts at the beginning of the trimmed line
    if (lineStartTrimmedText.startsWith(typedWord) && 'task'.toLowerCase().startsWith(typedWord.toLowerCase())) {
        const actualWordStartOffset = lineBeforeCursor.length - lineStartTrimmedText.length;
        const fromPos = line.from + actualWordStartOffset;

        return {
            from: fromPos,
            options: [
                {
                    label: "Task (definition)",
                    info: "Insert a new task definition",
                    type: "keyword",
                    apply: SIMPLIFIED_TASK_SNIPPET
                }
            ]
        };
    }
}

  // Helper to extract content within the last open quote segment
  const getFragmentInLastOpenQuote = (text) => {
    const lastOpenQuoteIndex = text.lastIndexOf('"');
    if (lastOpenQuoteIndex === -1) return null; // No open quote

    const lastClosingQuoteIndex = text.indexOf('"', lastOpenQuoteIndex + 1);
    if (lastClosingQuoteIndex !== -1) return null; // Already closed quote

    // Check if the current position is after the last open quote
    if (context.pos > line.from + lastOpenQuoteIndex) {
      return text.substring(lastOpenQuoteIndex + 1);
    }
    return null;
  };

  // ... after Task snippet logic ...

  const fragmentInQuote = getFragmentInLastOpenQuote(lineBeforeCursor);
  console.log('Fragment in quote:', fragmentInQuote);

  if (fragmentInQuote !== null) {
    // 2. Autocomplete for Task Names (inside dependency/name quotes)
    // Refined heuristic: Check if current quote is part of a Task definition parameters
    const isTaskParameterContext = lineBeforeCursor.match(/^Task\s*(?:"[^"]*"\s*){0,3}"(\w*)$/);
    const isExplicitDependencyContext = lineBeforeCursor.match(/(?:depends on|should happen before|should happen after)\s+"(\w*)$/);

    console.log('isTaskParameterContext:', isTaskParameterContext);
    console.log('isExplicitDependencyContext:', isExplicitDependencyContext);

    if (isTaskParameterContext || isExplicitDependencyContext) {
      console.log('Context: Task parameter or explicit dependency field');
      const parts = fragmentInQuote.split(',').map(s => s.trim());
      const lastPart = parts[parts.length - 1]; // Current fragment after last comma
      console.log('Dependency lastPart:', lastPart);

      options = availableTaskNames
        .filter(name => typeof name === 'string' && name.length > 0 && name.toLowerCase().startsWith(lastPart.toLowerCase()))
        .map(name => ({
          label: name,
          type: 'variable',
          apply: (view, completion) => { // 'from' and 'to' params aren't directly used here
            const fragmentStartInQuote = lineText.lastIndexOf(lastPart, context.pos - line.from - 1);
            const replaceFrom = line.from + fragmentStartInQuote;
            
            view.dispatch({
              changes: {
                from: replaceFrom,
                to: context.pos,
                insert: completion.label
              }
            });
            startCompletion(view); // Trigger new completion
          }
        }));

      if (options.length > 0) {
        console.log('Dependency options:', options.map(o => o.label));
        return {
          from: line.from + lineBeforeCursor.lastIndexOf(lastPart),
          options: options,
          validFor: /[^"]*/
        };
      }
    }


    // 3. Autocomplete for Duration Labels (inside quotes)
    const taskDurationFieldMatch = lineBeforeCursor.match(/^Task\s+"[^"]*"(?:\s+"[^"]*")?\s+"(\w*)$/); // Matches the third quoted string
    console.log('taskDurationFieldMatch:', taskDurationFieldMatch);
    if (taskDurationFieldMatch) {
      console.log('Context: Duration field');
      const potentialDuration = taskDurationFieldMatch[1];
      options = predefinedDurationLabels
        .filter(label => label.toLowerCase().startsWith(potentialDuration.toLowerCase()))
        .map(label => ({ label: label, type: 'keyword', apply: label }));

      if (options.length > 0) {
          console.log('Duration options:', options.map(o => o.label));
          return {
            from: line.from + lineBeforeCursor.lastIndexOf(potentialDuration),
            options: options,
            validFor: /\w*/
          };
      }
    }
  }
  
  // 4. Autocomplete for Global Bandwidth keywords
  if (trimmedLineBeforeCursor.startsWith('Global Bandwidth:') || trimmedLineBeforeCursor.startsWith('Global Bandwi')) {
    console.log('Context: Global Bandwidth');
    const wordMatch = context.matchBefore(/"?\w*"?$/);
    const currentVal = wordMatch ? wordMatch.text.replace(/"/g, '') : '';
    
    options = ['"unbound"', '1', '2', '3', '4', '5'].filter(opt => opt.replace(/"/g, '').toLowerCase().startsWith(currentVal.toLowerCase()));
    
    if (options.length > 0) {
        console.log('Global Bandwidth options:', options.map(o => o.label));
        return {
            from: context.pos - currentVal.length - (currentVal.startsWith('"') ? 1 : 0),
            options: options.map(o => ({ label: o, type: 'constant', apply: o })),
            validFor: /["\w]*/
        };
    }
  }

  console.log('No completion context matched.');
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

onUnmounted(() => {
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