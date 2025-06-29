/**
 * src/utils/parser.js
 *
 * This file contains the parsing logic for the Visual Task Scheduler's Markdown-like input.
 * It transforms raw text into structured data (tasks, dependencies, bandwidth settings, and errors).
 */

// --- Constants and Regular Expressions ---
const TASK_LINE_REGEX = /^Task\s+"([^"]+)"(?:\s+"([^"]*)")?\s+"([^"]+)"(?:\s+"([^"]*)")?\s*#?.*$/;
const DURATION_LABEL_DEFINITION_REGEX = /^([A-Z]+):\s*(\d+(\.\d+)?)\s*#?.*$/;
const GLOBAL_BANDWIDTH_REGEX = /^Global Bandwidth:\s*("unbound"|\d+)\s*#?.*$/;
const TASK_GROUP_BANDWIDTH_REGEX = /^Task Group\s+(?:"([^"]*)"\s+)?(?:\[([^\]]+)\]|\/([^\/]+)\/)\s+bandwidth:\s*("unbound"|\d+)\s*#?.*$/;
const DEPENDENCY_EXPLICIT_REGEX = /"([^"]+)"\s+(should happen before|depends on|should happen after)\s+"([^"]+)"\s*#?.*$/;


/**
 * Parses a single task definition line.
 * @param {string} line - The line of text to parse.
 * @returns {object|null} An object containing task data if parsed successfully, otherwise null.
 */
function parseTaskLine(line) {
    const match = line.match(TASK_LINE_REGEX);
    if (!match) {
        return null;
    }

    const [, name, description, durationStr, inlineDependenciesStr] = match;

    const task = {
        name: name.trim(),
        description: (description || '').trim(),
        duration: durationStr.trim(), // Will be resolved to numerical value later
        dependencies: [] // Initial empty array for dependencies
    };

    // Parse inline dependencies
    if (inlineDependenciesStr) {
        task.dependencies = inlineDependenciesStr
            .split(',')
            .map(dep => dep.trim())
            .filter(dep => dep.length > 0);
    }

    return task;
}

/**
 * Parses a duration label definition line (e.g., L:10).
 * @param {string} line - The line of text to parse.
 * @returns {object|null} An object { label, value } if parsed successfully, otherwise null.
 */
function parseDurationLabelDefinition(line) {
    const match = line.match(DURATION_LABEL_DEFINITION_REGEX);
    if (match) {
        return {
            label: match[1].trim(),
            value: parseFloat(match[2])
        };
    }
    return null;
}

/**
 * Parses a global bandwidth definition line.
 * @param {string} line - The line of text to parse.
 * @returns {number|'unbound'|null} The bandwidth value or 'unbound', otherwise null.
 */
function parseGlobalBandwidth(line) {
    const match = line.match(GLOBAL_BANDWIDTH_REGEX);
    if (match) {
        const value = match[1].trim();
        if (value === '"unbound"') {
            return 'unbound';
        }
        const numValue = parseInt(value, 10);
        return isNaN(numValue) ? null : numValue;
    }
    return null;
}

/**
 * Parses a task group bandwidth definition line.
 * @param {string} line - The line of text to parse.
 * @returns {object|null} An object { type: 'list'|'regex', identifiers: string[], bandwidth: number|'unbound' }
 * if parsed successfully, otherwise null.
 */
function parseTaskGroupBandwidth(line) {
    const match = line.match(TASK_GROUP_BANDWIDTH_REGEX);
    if (!match) {
        return null;
    }

    const [, groupName, listStr, regexStr, bandwidthValueStr] = match;
    let type, identifiers;

    if (listStr) {
        type = 'list';
        identifiers = listStr.split(',').map(name => name.trim().replace(/^"|"$/g, '')); // Remove quotes
    } else if (regexStr) {
        type = 'regex';
        identifiers = [regexStr.trim()];
    } else {
        return null; // Should not happen with the regex, but as a safeguard
    }

    let bandwidth;
    if (bandwidthValueStr === '"unbound"') {
        bandwidth = 'unbound';
    } else {
        const numValue = parseInt(bandwidthValueStr, 10);
        bandwidth = isNaN(numValue) ? null : numValue;
    }

    if (bandwidth === null) {
        return null; // Invalid bandwidth value
    }

    // Handle group name - use provided name or default to 'Unnamed Group'
    const name = (groupName && groupName.trim() !== '') ? groupName.trim() : 'Unnamed Group';

    return { type, name, identifiers, bandwidth };
}

/**
 * Parses an explicit dependency statement (e.g., "Task A" should happen before "Task B").
 * @param {string} line - The line of text to parse.
 * @returns {object|null} An object { source, target } if parsed successfully, otherwise null.
 */
// src/utils/parser.js

// src/utils/parser.js (Your updated parseExplicitDependency function)
function parseExplicitDependency(line) {
    const match = line.match(DEPENDENCY_EXPLICIT_REGEX);
    if (match) {
        const [, task1, relationship, task2] = match;
        let source, target;

        if (relationship === 'should happen before') {
            // Task1 should happen before Task2 means Task1 -> Task2
            source = task1.trim();
            target = task2.trim();
        } else if (relationship === 'depends on') {
            // Task1 depends on Task2 means Task2 -> Task1
            // So, Task2 is the SOURCE (predecessor), Task1 is the TARGET (successor)
            source = task2.trim(); // CORRECTED: This makes 'Task B' the source
            target = task1.trim(); // CORRECTED: This makes 'Task C' the target
        } else if (relationship === 'should happen after') {
            // Task1 should happen after Task2 means Task2 -> Task1
            // So, Task2 is the SOURCE, Task1 is the TARGET
            source = task2.trim();
            target = task1.trim();
        } else {
            // Fallback (shouldn't be hit with correct regex)
            source = task1.trim();
            target = task2.trim();
        }

        return { source, target };
    }
    return null;
}

/**
 * Main function to parse the entire Markdown input.
 * @param {string} markdownInput - The raw Markdown text from the editor.
 * @returns {object} An object containing parsed data: { tasks, dependencies, durationLabels, globalBandwidth, taskGroups, errors }
 */
export function parseMarkdown(markdownInput) {
    const lines = markdownInput.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('#'));

    const tasks = {}; // Use an object for quick lookup by name
    const uniqueDependencies  = new Set(); // Stores { source, target }
    const durationLabels = {}; // Stores { label: value }
    let globalBandwidth = 'unbound'; // Default
    const taskGroups = []; // Stores parsed task group objects
    const errors = []; // Stores { line: string, message: string, type: 'error'|'warning' }

    // Helper to add a dependency to the set
    const addDependency = (source, target, originalLineNum = 'N/A') => { // Add originalLineNum parameter
        if (source === target) {
            errors.push({
                line: originalLineNum, // Use provided line number for self-dependency error
                message: `Task "${source}" cannot depend on itself.`,
                type: 'error'
            });
            return;
        }
        uniqueDependencies.add(`${source}->${target}`);
    };

    // First pass: Identify task definitions and explicit directives
    lines.forEach((line, index) => {
        const originalLineNum = index + 1; // For error reporting

        // Remove comments for parsing
        const effectiveLine = line.split('#')[0].split('//')[0].trim();
        if (!effectiveLine) return; // Skip empty lines or lines with only comments

        // Try to parse as a task
        const task = parseTaskLine(effectiveLine);
        if (task) {
            task.originalLineNum = originalLineNum;
            if (tasks[task.name]) {
                errors.push({
                    line: originalLineNum,
                    message: `Duplicate task name "${task.name}". Task names must be unique.`,
                    type: 'error'
                });
            }
            tasks[task.name] = task;
            // Dependencies defined inline will be processed in a second pass
            return;
        }

        // Try to parse as duration label definition
        const labelDef = parseDurationLabelDefinition(effectiveLine);
        if (labelDef) {
            if (durationLabels[labelDef.label]) {
                errors.push({
                    line: originalLineNum,
                    message: `Duplicate definition for duration label "${labelDef.label}". The last definition will take precedence.`,
                    type: 'warning'
                });
            }
            durationLabels[labelDef.label] = labelDef.value;
            return;
        }

        // Try to parse as global bandwidth
        const gb = parseGlobalBandwidth(effectiveLine);
        if (gb !== null) { // Check for null, as 0 is a valid bandwidth
            if (globalBandwidth !== 'unbound' && originalLineNum > 1) { // Only warn if it's a subsequent definition
                errors.push({
                    line: originalLineNum,
                    message: `Duplicate Global Bandwidth definition. The last one defined will be used.`,
                    type: 'warning'
                });
            }
            globalBandwidth = gb;
            return;
        }

        // Try to parse as task group bandwidth
        const tg = parseTaskGroupBandwidth(effectiveLine);
        if (tg) {
            taskGroups.push(tg);
            return;
        }

        // Try to parse as explicit dependency
        const explicitDep = parseExplicitDependency(effectiveLine);
        if (explicitDep) {
            addDependency(explicitDep.source, explicitDep.target, originalLineNum); // Use addDependency
            return;
        }

        // If none of the above, it's an unrecognized line
        errors.push({
            line: originalLineNum,
            message: `Unrecognized or malformed line syntax: "${effectiveLine}"`,
            type: 'error'
        });
    });

    // Second pass: Process inline dependencies from parsed tasks and validate all dependencies
    Object.values(tasks).forEach(task => {
        task.dependencies.forEach(depName => {
            // Call addDependency with the task's original line number for better error reporting
            addDependency(depName, task.name, task.originalLineNum); // Inline: depName is source, task.name is target
        });
    });

    // Resolve duration labels to numerical values
    Object.values(tasks).forEach(task => {
        const originalDuration = task.duration;
        const numValue = parseFloat(originalDuration);
        if (!isNaN(numValue)) {
            task.resolvedDuration = numValue;
        } else if (durationLabels[originalDuration]) {
            task.resolvedDuration = durationLabels[originalDuration];
        } else {
            errors.push({
                line: task.originalLineNum || 'N/A', // Use task's stored line number if available
                message: `Task "${task.name}" has an undefined duration label: "${originalDuration}".`,
                type: 'error'
            });
            task.resolvedDuration = 1; // Default to 1 to allow scheduling
        }
    });

    // Validate that all referenced tasks in dependencies and task groups actually exist
    const definedTaskNames = new Set(Object.keys(tasks));

    // Validate explicit and inline dependencies
    // Convert unique dependencies from Set to Array and then validate
    const finalDependencies = Array.from(uniqueDependencies).map(depStr => {
        const [source, target] = depStr.split('->');
        return { source, target };
    }).sort((a, b) => { // Optional: Sort for consistent test output order
        if (a.source !== b.source) return a.source.localeCompare(b.source);
        return a.target.localeCompare(b.target);
    });

    finalDependencies.forEach(dep => { // Iterate over the finalDependencies array
        if (!definedTaskNames.has(dep.source)) {
            errors.push({
                line: 'N/A', // Cannot easily map back to original line after deduplication
                message: `Dependency source task "${dep.source}" is not defined.`,
                type: 'error'
            });
        }
        if (!definedTaskNames.has(dep.target)) {
            errors.push({
                line: 'N/A', // Cannot easily map back to original line after deduplication
                message: `Dependency target task "${dep.target}" is not defined.`,
                type: 'error'
            });
        }
    });

    // Validate task group identifiers
    taskGroups.forEach(group => {
        if (group.type === 'list') {
            group.identifiers.forEach(taskName => {
                if (!definedTaskNames.has(taskName)) {
                    errors.push({
                        line: 'N/A',
                        message: `Task Group references undefined task "${taskName}".`,
                        type: 'warning'
                    });
                }
            });
        }
        // Regex identifiers are not validated here, as they are patterns
    });

    // Return tasks as an array for easier iteration in subsequent steps
    return {
        tasks: Object.values(tasks), // Convert map back to array
        dependencies: finalDependencies ,
        durationLabels: durationLabels,
        globalBandwidth: globalBandwidth,
        taskGroups: taskGroups,
        errors: errors
    };
}