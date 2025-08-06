### `scheduler.js` Module Interface

This module provides the core scheduling logic for the Visual Task Scheduler. The primary function, `scheduleTasks`, takes the raw parsed data and computes the start and end times for all tasks, respecting dependencies and concurrency limits.

-----

#### `scheduleTasks` Function Interface

`export function scheduleTasks(tasks, dependencies, globalBandwidth, taskGroups)`

**1. Input Contract**

The `scheduleTasks` function accepts four parameters, typically the structured output from the `parser.js` module.

**Input JSON Structure:**

```json
{
  "tasks": [
    {
      "name": "Task A",
      "resolvedDuration": 10
    },
    {
      "name": "Task B",
      "resolvedDuration": 5
    }
  ],
  "dependencies": [
    {
      "source": "Task A",
      "target": "Task B"
    }
  ],
  "globalBandwidth": "unbound", // Or a number, e.g., 3
  "taskGroups": [
    {
      "type": "list",
      "name": "Group Alpha",
      "identifiers": ["Task A", "Task B"],
      "bandwidth": 2
    },
    {
      "type": "regex",
      "name": "Group Beta",
      "identifiers": ["^Task C"],
      "bandwidth": "unbound"
    }
  ]
}
```

  * **`tasks`** (`Array<Object>`): An array of task objects, where each task has a unique `name` and a numeric `resolvedDuration`.
  * **`dependencies`** (`Array<Object>`): An array of dependency objects. Each object defines a relationship with a `source` (predecessor) and a `target` (successor).
  * **`globalBandwidth`** (`number` or `'unbound'`): The overall concurrency limit.
  * **`taskGroups`** (`Array<Object>`): An array of objects defining concurrency limits for specific groups of tasks, identified by a list of names or a regular expression.

**2. Output Contract**

The function returns a single object containing the scheduled tasks and a list of any errors encountered.

**Output JSON Structure:**

```json
{
  "scheduledTasks": [
    {
      "name": "Task A",
      "resolvedDuration": 10,
      "startTime": 0,
      "endTime": 10,
      "earliestPossibleStartTime": 0,
      "assignedBandwidthGroup": {
        "type": "list",
        "name": "Group Alpha",
        "identifiers": ["Task A", "Task B"],
        "bandwidth": 2
      }
    },
    {
      "name": "Task B",
      "resolvedDuration": 5,
      "startTime": 10,
      "endTime": 15,
      "earliestPossibleStartTime": 10,
      "assignedBandwidthGroup": {
        "type": "list",
        "name": "Group Alpha",
        "identifiers": ["Task A", "Task B"],
        "bandwidth": 2
      }
    }
  ],
  "errors": [
    {
      "message": "Circular dependency detected: Task C -> Task D -> Task C",
      "type": "error",
      "line": "N/A"
    },
    {
      "message": "Scheduling error: Task 'Task E' could not be scheduled.",
      "type": "error",
      "line": 5
    }
  ]
}
```

  * **`scheduledTasks`** (`Array<Object>`): An array of task objects, now enriched with scheduling information like `startTime` and `endTime`.
  * **`errors`** (`Array<Object>`): An array of errors and warnings. Errors may include circular dependencies, invalid inputs, or tasks that could not be scheduled. Each error object contains a `message`, a `type` (`'error'` or `'warning'`), and a `line` number for context.