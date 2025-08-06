/**
 * src/utils/parser.js
 *
 * This file contains the parsing logic for the Visual Task Scheduler's Markdown-like input.
 * It transforms raw text into structured data (tasks, dependencies, bandwidth settings, and errors).
 */

// --- Constants and Regular Expressions ---
const TASK_LINE_REGEX = /^Task\s+"([^"]+)"(?:\s+"([^"]*)")?\s+"([^"]+)"(?:\s+"([^"]*)")?(?:\s+start:\s*"?(\d{4}-\d{2}-\d{2})"?$)?/;
const DURATION_LABEL_DEFINITION_REGEX = /^([A-Z]+):\s*(\d+(\.\d+)?)$/;
const GLOBAL_BANDWIDTH_REGEX = /^Global Bandwidth:\s*("unbound"|\d+)$/;
const TASK_GROUP_BANDWIDTH_REGEX = /^Task Group\s+(?:"([^"]*)"\s+)?(?:\[([^\]]+)\]|\/([^\/]+)\/)\s+bandwidth:\s*("unbound"|\d+)(?:\s+start:\s*"?(\d{4}-\d{2}-\d{2})"?$)?$/;
const DEPENDENCY_EXPLICIT_REGEX = /"([^"]+)"\s+(should happen before|depends on|should happen after)\s+"([^"]+)"$/;
const DETAIL_KEY_LINE_REGEX = /^(\s*)([^:]+):\s*$/;
const DETAIL_VALUE_LINE_REGEX = /^(\s*)-\s*(.+)$/;

// --- New Directives for PRD ---
const START_DATE_REGEX = /^Start Date:\s*"?(\d{4}-\d{2}-\d{2})"?$/;
const WORK_DAYS_REGEX = /^Work Days:\s*([A-Za-z,\s]+)$/;
const HOLIDAYS_REGEX = /^Holidays:\s*([\d-]+(?:,\s*[\d-]+)*)$/;
const DURATION_MODE_REGEX = /^Duration Mode:\s*(working|elapsed)$/;
const NON_WORKING_DAY_COLOR_REGEX = /^Non-working Day Color:\s*(#?[\da-fA-F]{3,6})?$/;

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
    // We get the date from the 5th capturing group, which handles both quoted and unquoted dates.
    const [, name, description, durationStr, inlineDependenciesStr, startDateStr] = match;

    const task = {
        name: name.trim(),
        description: (description || '').trim(),
        duration: durationStr.trim(),
        dependencies: [],
        startDate: startDateStr || null,
    };

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
 * @returns {object|null} An object { type: 'list'|'regex', identifiers: string[], bandwidth: number|'unbound', startDate: string|null }
 * if parsed successfully, otherwise null.
 */
function parseTaskGroupBandwidth(line) {
    const match = line.match(TASK_GROUP_BANDWIDTH_REGEX);
    if (!match) {
        return null;
    }

    const [, groupName, listStr, regexStr, bandwidthValueStr, startDateStr] = match;
    let type, identifiers;

    if (listStr) {
        type = 'list';
        identifiers = listStr.split(',').map(name => name.trim().replace(/^"|"$/g, ''));
    } else if (regexStr) {
        type = 'regex';
        identifiers = [regexStr.trim()];
    } else {
        return null;
    }

    let bandwidth;
    if (bandwidthValueStr === '"unbound"') {
        bandwidth = 'unbound';
    } else {
        const numValue = parseInt(bandwidthValueStr, 10);
        bandwidth = isNaN(numValue) ? null : numValue;
    }

    if (bandwidth === null) {
        return null;
    }

    const name = (groupName && groupName.trim() !== '') ? groupName.trim() : 'Unnamed Group';
    const startDate = startDateStr || null;

    return { type, name, identifiers, bandwidth, startDate };
}

/**
 * Parses an explicit dependency statement (e.g., "Task A" should happen before "Task B").
 * @param {string} line - The line of text to parse.
 * @returns {object|null} An object { source, target } if parsed successfully, otherwise null.
 */
function parseExplicitDependency(line) {
    const match = line.match(DEPENDENCY_EXPLICIT_REGEX);
    if (match) {
        const [, task1, relationship, task2] = match;
        let source, target;

        if (relationship === 'should happen before') {
            source = task1.trim();
            target = task2.trim();
        } else if (relationship === 'depends on') {
            source = task2.trim();
            target = task1.trim();
        } else if (relationship === 'should happen after') {
            source = task2.trim();
            target = task1.trim();
        } else {
            source = task1.trim();
            target = task2.trim();
        }

        return { source, target };
    }
    return null;
}

/**
 * Parses a global Start Date definition line.
 * @param {string} line - The line of text to parse.
 * @returns {string|null} The date string if parsed successfully, otherwise null.
 */
function parseStartDate(line) {
    const match = line.match(START_DATE_REGEX);
    if (match) {
        const dateStr = match[1];
        return dateStr;
    }
    return null;
}

// Replace your existing parseWorkDays function with this:
function parseWorkDays(line) {
    const match = line.match(WORK_DAYS_REGEX);
    if (match) {
        const validDayNames = new Set([
            'Mon', 'Monday', 'Tue', 'Tuesday', 'Wed', 'Wednesday',
            'Thu', 'Thursday', 'Fri', 'Friday', 'Sat', 'Saturday',
            'Sun', 'Sunday'
        ]);

        const days = match[1].split(',').map(day => day.trim());
        const validatedDays = [];
        let isValid = true;

        for (const day of days) {
            // Check if the day (case-insensitive) is in our set of valid names
            if (validDayNames.has(day.charAt(0).toUpperCase() + day.slice(1).toLowerCase())) {
                // To keep the output consistent, we can standardize the format
                // For example, always use the three-letter abbreviation
                const standardizedDay = day.charAt(0).toUpperCase() + day.slice(1, 3).toLowerCase();
                validatedDays.push(standardizedDay);
            } else {
                isValid = false;
                break; // Stop processing if any day is invalid
            }
        }

        if (isValid) {
            return validatedDays;
        }
    }
    return null; // Return null if the regex doesn't match or a day is invalid
}

/**
 * Parses a Holidays definition line.
 * @param {string} line - The line of text to parse.
 * @returns {string[]|null} An array of date strings if parsed successfully, otherwise null.
 */
function parseHolidays(line) {
    const match = line.match(HOLIDAYS_REGEX);
    if (match) {
        return match[1].split(',').map(date => date.trim());
    }
    return null;
}

/**
 * Parses a Duration Mode definition line.
 * @param {string} line - The line of text to parse.
 * @returns {string|null} The mode string ('working' or 'elapsed') if parsed successfully, otherwise null.
 */
function parseDurationMode(line) {
    const match = line.match(DURATION_MODE_REGEX);
    if (match) {
        return match[1];
    }
    return null;
}

/**
 * Parses a Non-working Day Color definition line.
 * @param {string} line - The line of text to parse.
 * @returns {string|null} The color code string if parsed successfully, otherwise null.
 */
function parseNonWorkingDayColor(line) {
    const match = line.match(NON_WORKING_DAY_COLOR_REGEX);
    if (match && match[1]) {
        // The first capture group is the color code itself.
        return match[1];
    }
    return null;
}

/**
 * Main function to parse the entire Markdown input.
 * @param {string} markdownInput - The raw Markdown text from the editor.
 * @returns {object} An object containing parsed data: { tasks, dependencies, durationLabels, globalBandwidth, taskGroups, errors, startDate, workDays, holidays, durationMode, nonWorkingDayColor }
 */
export function parseMarkdown(markdownInput) {
    const lines = markdownInput.split('\n');

    const tasks = {};
    const uniqueDependencies = new Set();
    const durationLabels = {};
    const taskGroups = [];
    const errors = [];

    // --- New PRD State Variables with Defaults ---
    let globalBandwidth = 'unbound';
    let globalStartDate = null;
    let workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    let holidays = [];
    let durationMode = 'working';
    let nonWorkingDayColor = null;

    // State variables for task details parsing
    let currentTask = null;
    let currentDetailKey = null;
    let baseTaskIndentation = null;
    let currentKeyIndentation = null;
    let currentValueIndentation = null;

    // Helper to add a dependency to the set
    const addDependency = (source, target, originalLineNum = 'N/A') => {
        if (source === target) {
            errors.push({
                line: originalLineNum,
                message: `Task "${source}" cannot depend on itself.`,
                type: 'error'
            });
            return;
        }
        uniqueDependencies.add(`${source}->${target}`);
    };

    // First pass: Identify task definitions and explicit directives
    lines.forEach((line, index) => {
        const originalLineNum = index + 1;

        console.log(`[Parser Debug] Line ${originalLineNum}: '${line}'`);
    
        let processedLine = line;

        // Remove comments first
        const slashCommentIndex = processedLine.indexOf('//');

        if (slashCommentIndex !== -1) {
            processedLine = processedLine.substring(0, slashCommentIndex);
        }
        
        // Trim leading and trailing whitespace
        const effectiveLine = processedLine.replace(/\s+/g, ' ').trim();

        let detailKeyMatch = null;
        let detailValueMatch = null;

        console.log(`[Parser Debug] Effective Line: '${effectiveLine}'`);


        const leadingWhitespaceMatch = line.match(/^(\s*)/);
        const currentLineRawIndentation = leadingWhitespaceMatch ? leadingWhitespaceMatch[1].length : 0;

        if (!effectiveLine) {
            if (currentTask) {
                currentTask = null;
                currentDetailKey = null;
                baseTaskIndentation = null;
                currentKeyIndentation = null;
                currentValueIndentation = null;
            }
            return;
        }

        const task = parseTaskLine(effectiveLine);
        if (task) {
            currentTask = task;
            currentDetailKey = null;
            baseTaskIndentation = currentLineRawIndentation;
            currentKeyIndentation = null;
            currentValueIndentation = null;
            task.originalLineNum = originalLineNum;
            task.details = {};

            if (tasks[task.name]) {
                errors.push({
                    line: originalLineNum,
                    message: `Duplicate task name "${task.name}". Task names must be unique.`,
                    type: 'error'
                });
            }
            tasks[task.name] = task;
            return;
        }

        if (currentTask) {
            detailKeyMatch = line.match(DETAIL_KEY_LINE_REGEX);
            if (detailKeyMatch) {
                const parsedIndentation = detailKeyMatch[1].length;
                const key = detailKeyMatch[2].trim();

                if (parsedIndentation > baseTaskIndentation) {
                    if (currentKeyIndentation === null || parsedIndentation === currentKeyIndentation) {
                        currentDetailKey = key;
                        currentTask.details[currentDetailKey] = [];
                        currentKeyIndentation = parsedIndentation;
                        currentValueIndentation = currentKeyIndentation + 2;
                        return;
                    } else {
                        errors.push({
                            line: originalLineNum,
                            message: `Inconsistent indentation for task detail key "${key}". Expected ${currentKeyIndentation} spaces.`,
                            type: 'error'
                        });
                        currentTask = null;
                        currentDetailKey = null;
                        baseTaskIndentation = null;
                        currentKeyIndentation = null;
                        currentValueIndentation = null;
                        return;
                    }
                } else {
                    currentTask = null;
                    currentDetailKey = null;
                    baseTaskIndentation = null;
                    currentKeyIndentation = null;
                    currentValueIndentation = null;
                }
            }

            if (currentTask && currentDetailKey) {
                const detailValueMatch = line.match(DETAIL_VALUE_LINE_REGEX);
                if (detailValueMatch) {
                    const parsedIndentation = detailValueMatch[1].length;
                    const value = detailValueMatch[2].trim();

                    if (parsedIndentation >= currentValueIndentation) {
                        currentTask.details[currentDetailKey].push(value);
                        return;
                    } else {
                        errors.push({
                            line: originalLineNum,
                            message: `Inconsistent indentation for task detail value "- ${value}". Expected at least ${currentValueIndentation} spaces.`,
                            type: 'error'
                        });
                        currentTask = null;
                        currentDetailKey = null;
                        baseTaskIndentation = null;
                        currentKeyIndentation = null;
                        currentValueIndentation = null;
                        return;
                    }
                }
            }
        }

        if (currentTask && !detailKeyMatch && !detailValueMatch) {
            currentTask = null;
            currentDetailKey = null;
            baseTaskIndentation = null;
            currentKeyIndentation = null;
            currentValueIndentation = null;
        }

        if (!currentTask) {
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

            const gb = parseGlobalBandwidth(effectiveLine);
            if (gb !== null) {
                if (globalBandwidth !== 'unbound' && originalLineNum > 1) {
                    errors.push({
                        line: originalLineNum,
                        message: `Duplicate Global Bandwidth definition. The last one defined will be used.`,
                        type: 'warning'
                    });
                }
                globalBandwidth = gb;
                return;
            }

            const tg = parseTaskGroupBandwidth(effectiveLine);
            if (tg) {
                taskGroups.push(tg);
                return;
            }

            const explicitDep = parseExplicitDependency(effectiveLine);
            if (explicitDep) {
                addDependency(explicitDep.source, explicitDep.target, originalLineNum);
                return;
            }

            // --- New parsing logic for PRD directives ---
            const sd = parseStartDate(effectiveLine);
            if (sd) {
                if (globalStartDate) {
                    errors.push({
                        line: originalLineNum,
                        message: `Duplicate Start Date definition. The last one defined will be used.`,
                        type: 'warning'
                    });
                }
                globalStartDate = sd;
                return;
            }

            const wd = parseWorkDays(effectiveLine);
            if (wd) {
                workDays = wd;
                return;
            }

            const h = parseHolidays(effectiveLine);
            if (h) {
                holidays = h;
                return;
            }

            const dm = parseDurationMode(effectiveLine);
            if (dm) {
                durationMode = dm;
                return;
            }

            const nwColor = parseNonWorkingDayColor(effectiveLine);
            if (nwColor) {
                nonWorkingDayColor = nwColor;
                return;
            }

            errors.push({
                line: originalLineNum,
                message: `Unrecognized or malformed line syntax: "${effectiveLine}"`,
                type: 'error'
            });
        }
    });

    // Second pass: Process inline dependencies from parsed tasks and validate all dependencies
    Object.values(tasks).forEach(task => {
        task.dependencies.forEach(depName => {
            addDependency(depName, task.name, task.originalLineNum);
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
                line: task.originalLineNum || 'N/A',
                message: `Task "${task.name}" has an undefined duration label: "${originalDuration}".`,
                type: 'error'
            });
            task.resolvedDuration = 1;
        }
    });

    // Validate that all referenced tasks in dependencies and task groups actually exist
    const definedTaskNames = new Set(Object.keys(tasks));

    // Validate explicit and inline dependencies
    const finalDependencies = Array.from(uniqueDependencies).map(depStr => {
        const [source, target] = depStr.split('->');
        return { source, target };
    }).sort((a, b) => {
        if (a.source !== b.source) return a.source.localeCompare(b.source);
        return a.target.localeCompare(b.target);
    });

    finalDependencies.forEach(dep => {
        if (!definedTaskNames.has(dep.source)) {
            errors.push({
                line: 'N/A',
                message: `Dependency source task "${dep.source}" is not defined.`,
                type: 'error'
            });
        }
        if (!definedTaskNames.has(dep.target)) {
            errors.push({
                line: 'N/A',
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
    });

    // --- Expanded Return Object ---
    return {
        tasks: Object.values(tasks),
        dependencies: finalDependencies,
        durationLabels: durationLabels,
        globalBandwidth: globalBandwidth,
        taskGroups: taskGroups,
        errors: errors,
        startDate: globalStartDate,
        workDays: workDays,
        holidays: holidays,
        durationMode: durationMode,
        nonWorkingDayColor: nonWorkingDayColor
    };
}