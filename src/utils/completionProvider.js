// src/utils/completionProvider.js

// Import necessary CodeMirror types and functions
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view'; // EditorView for the 'view' instance
import { startCompletion } from '@codemirror/autocomplete'; // For chaining completions

// --- Autocomplete Data ---
export const predefinedDurationLabels = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export let availableTaskNames = []; // This will be set by the calling environment (for tests)

// New: Simpler Task definition snippet string
export const SIMPLIFIED_TASK_SNIPPET = `Task "Name" "Description" "Duration" "Dependencies"`;

/**
 * Sets the available task names for autocompletion.
 * This is exposed so tests and the main component can update it.
 * @param {string[]} names
 */
export const setAvailableTaskNamesForCompletion = (names) => {
    availableTaskNames = Array.isArray(names) ? names.filter(name => typeof name === 'string' && name.length > 0) : [];
};

/**
 * The core completion source function for CodeMirror.
 * @param {CompletionContext} context - The CodeMirror completion context.
 * @returns {CompletionResult|null}
 */
export const myCompletion = (context) => {
    console.log('--- Autocomplete Check (Test Run) ---'); // Differentiate test logs
    const line = context.state.doc.lineAt(context.pos);
    const lineText = line.text;
    const lineBeforeCursor = lineText.substring(0, context.pos - line.from);
    const trimmedLineBeforeCursor = lineBeforeCursor.trimStart();
    console.log('Line before cursor:', lineBeforeCursor);
    console.log('Trimmed line before cursor:', trimmedLineBeforeCursor);
    console.log('Cursor pos relative to line start:', context.pos - line.from);

    let options = [];

    // 1. Suggest 'TASK' snippet (literal string) at the start of a line
    const word = context.matchBefore(/\w*$/);

    if (word && word.text.length > 0) { // Ensure there's a word typed
        const typedWord = word.text; // The word typed before the cursor

        // Check if the 'task' keyword starts with what the user has typed
        if ('task'.toLowerCase().startsWith(typedWord.toLowerCase())) {
            const lineStartTrimmedText = lineBeforeCursor.trimStart();
            const wordStartsAtLineStart = lineStartTrimmedText.startsWith(typedWord);

            if (wordStartsAtLineStart) {
                console.log('Task snippet: Triggered for word:', typedWord);
                return {
                    from: word.from,
                    options: [
                        {
                            label: "Task (definition)",
                            info: "Insert a new task definition",
                            type: "keyword",
                            apply: SIMPLIFIED_TASK_SNIPPET
                        }
                    ],
                    validFor: /\w*/
                };
            }
        }
    }

    // Helper to extract content within the last open quote segment
    const getFragmentInLastOpenQuote = (text) => {
        const lastOpenQuoteIndex = text.lastIndexOf('"');
        if (lastOpenQuoteIndex === -1) return null; // No open quote

        const lastClosingQuoteIndex = text.indexOf('"', lastOpenQuoteIndex + 1);
        if (lastClosingQuoteIndex !== -1) return null; // Already closed quote

        // Check if the current position is after the last open quote
        if (context.pos > line.from + lastOpenQuoteIndex) { // 'line.from' is needed here for absolute position check
            return text.substring(lastOpenQuoteIndex + 1);
        }
        return null;
    };

    const fragmentInQuote = getFragmentInLastOpenQuote(lineBeforeCursor);
    console.log('Fragment in quote:', fragmentInQuote);

    if (fragmentInQuote !== null) {

        // Inside `if (fragmentInQuote !== null)` block
        // --- Lines ~117-120 in your provided code ---
        // Let's bring back simplified versions for direct use in the `if`
        const isTaskParamContextMatch = lineBeforeCursor.match(/^Task\s*(?:"[^"]*"\s*){0,3}"([^"]*)$/); // Matches any of the 4 quotes
        const isExplicitDepContextMatch = lineBeforeCursor.match(/(?:depends on|should happen before|should happen after)\s+"([^"]*)$/);

        console.log('isTaskParamContextMatch:', isTaskParamContextMatch); // Add this log
        console.log('isExplicitDepContextMatch:', isExplicitDepContextMatch); // Add this log

        // The condition to enter the dependency/name autocomplete block:
        if (isTaskParamContextMatch || isExplicitDepContextMatch) {
            console.log('Context: Task parameter or explicit dependency field triggered (simplified).');

            const targetMatch = isExplicitDepContextMatch || isTaskParamContextMatch;
            // The fragment being typed might be in capture group 1 of these regexes.
            const currentFragmentFromRegex = targetMatch ? targetMatch[1] : '';

            // Take the fragment from `getFragmentInLastOpenQuote` as primary, but use regex for context.
            const lastPart = fragmentInQuote.split(',').map(s => s.trim()).pop();

            console.log('Dependency lastPart (from fragmentInQuote):', lastPart);

            options = availableTaskNames
                .filter(name => typeof name === 'string' && name.length > 0 && name.toLowerCase().startsWith(lastPart.toLowerCase()))
                .map(name => ({
                    label: name,
                    type: 'variable',
                    apply: (viewInstance, completion) => {
                        const currentLineText = viewInstance.state.doc.lineAt(context.pos).text; // Get current line text
                        const currentLineBeforeCursor = currentLineText.substring(0, context.pos - viewInstance.state.doc.lineAt(context.pos).from);
                        const currentFragmentInQuote = getFragmentInLastOpenQuote(currentLineBeforeCursor);

                        // Find start of the current fragment after last comma in the current quoted text
                        const partsInCurrentQuote = currentFragmentInQuote ? currentFragmentInQuote.split(',').map(s => s.trim()) : [];
                        const lastPartInCurrentQuote = partsInCurrentQuote[partsInCurrentQuote.length - 1];

                        const relativeStart = currentLineBeforeCursor.lastIndexOf(lastPartInCurrentQuote); // Relative to line start
                        const replaceFrom = viewInstance.state.doc.lineAt(context.pos).from + relativeStart; // Absolute position

                        viewInstance.dispatch({
                            changes: {
                                from: replaceFrom,
                                to: context.pos,
                                insert: completion.label
                            },
                            selection: EditorSelection.cursor(replaceFrom + completion.label.length)
                        });
                        // Trigger new completion for more dependencies
                        if (viewInstance instanceof EditorView) {
                            setTimeout(() => { startCompletion(viewInstance); }, 50);
                        } else {
                            // For test mocks, ensure startCompletion is called directly
                            console.log('Calling startCompletion directly for test mock:', viewInstance);
                            startCompletion(viewInstance);
                        }
                    }
                }));

            if (options.length > 0) {
                console.log('Dependency options:', options.map(o => o.label));
                return {
                    from: line.from + lineBeforeCursor.lastIndexOf(lastPart), // This `from` calculation is for the initial result, not `apply`
                    options: options,
                    validFor: /[^"]*/
                };
            }
        }


        // 3. Autocomplete for Duration Labels (inside quotes)
        const taskDurationFieldMatch = lineBeforeCursor.match(/^Task\s+"[^"]*"(?:\s+"[^"]*")?\s+"(\w*)$/);
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