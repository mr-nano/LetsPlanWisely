### Input/Output Contract for `parser.js`

This document outlines the contract for the `parser.js` module, specifically for the main `parseMarkdown` function. It details the expected input format and the structured data output.

-----

### 1\. Input: `parseMarkdown(markdownInput)`

The `parseMarkdown` function accepts a single argument:

  - `markdownInput` (`string`): The raw text content from the Visual Task Scheduler editor. This text is a Markdown-like domain-specific language for defining tasks, dependencies, and scheduling constraints.

The parser expects the input to conform to the following syntax rules:

  - **Task Definition:**
    `Task "Task Name" "Description (optional)" "Duration" "Dependency1,Dependency2 (optional)"`

      - All parts are enclosed in double quotes. The description and inline dependencies are optional.
      - The duration can be a number (e.g., `"10"`) or a defined duration label (e.g., `"L"`).

  - **Task Details:**

      - A task can be followed by indented key-value pairs.
      - The key line ends with a colon: `   Key: `
      - The value line starts with a hyphen and is further indented: `     - Value `
      - Indentation is crucial and must be consistent.

  - **Duration Label Definition:**
    `L: 10`

      - Defines a duration label (e.g., `L`) and its numerical value.

  - **Global Bandwidth:**
    `Global Bandwidth: 5`

      - Sets a global concurrency limit for all tasks. Can also be `"unbound"`.

  - **Task Group Bandwidth:**
    `Task Group "Group Name" ["Task A", "Task B"] bandwidth: 2`

      - Defines a concurrency limit for a specific group of tasks.
      - A group can be defined by a comma-separated list of task names in square brackets or by a regular expression in forward slashes (e.g., `/^Task \d+$/`).

  - **Explicit Dependency:**
    `"Task A" should happen before "Task B"`
    `"Task C" depends on "Task D"`
    `"Task E" should happen after "Task F"`

      - Defines a dependency relationship between two tasks.

  - **Comments:**

      - Lines starting with `#` or `//` are treated as comments and ignored.

### 2\. Output: `object`

The `parseMarkdown` function returns a single object with the following structure. Each key represents a different type of parsed data from the input.

```json
{
  "tasks": [
    // An array of all parsed tasks.
  ],
  "dependencies": [
    // An array of all parsed dependencies.
  ],
  "durationLabels": {
    // An object mapping duration labels to their values.
  },
  "globalBandwidth": "unbound", // The global bandwidth setting.
  "taskGroups": [
    // An array of all parsed task groups.
  ],
  "errors": [
    // An array of all errors and warnings encountered during parsing.
  ]
}
```

#### 2.1. `tasks` (`Array<Object>`)

An array of task objects, where each object has the following properties:

| Property | Type | Description |
|---|---|---|
| `name` | `string` | The unique name of the task. |
| `description` | `string` | The description of the task. Can be an empty string. |
| `duration` | `string` | The raw duration string from the input (e.g., `"10"` or `"L"`). |
| `resolvedDuration` | `number` | The numerical duration value after resolving labels. Defaults to `1` if the label is not found. |
| `dependencies` | `Array<string>` | An array of task names listed as inline dependencies. These are also included in the main `dependencies` output array. |
| `details` | `object` | An object containing key-value pairs from the indented details section. The values are an array of strings. |
| `originalLineNum` | `number` | The line number in the original input where the task was defined. |

**Example Task Object:**

```json
{
  "name": "Task A",
  "description": "First task in the pipeline",
  "duration": "L",
  "resolvedDuration": 10,
  "dependencies": ["Task Z"],
  "details": {
    "Assignee": ["John Doe"],
    "Tags": ["important", "frontend"]
  },
  "originalLineNum": 5
}
```

#### 2.2. `dependencies` (`Array<Object>`)

An array of objects representing all dependencies, both inline and explicit. Each object has:

| Property | Type | Description |
|---|---|---|
| `source` | `string` | The name of the predecessor task. |
| `target` | `string` | The name of the successor task. |

**Example Dependency Array:**

```json
[
  { "source": "Task Z", "target": "Task A" }, // From inline dependency
  { "source": "Task C", "target": "Task D" }  // From explicit dependency
]
```

#### 2.3. `durationLabels` (`Object`)

An object mapping duration labels to their numeric values.

**Example `durationLabels` Object:**

```json
{
  "L": 10,
  "M": 20,
  "S": 5
}
```

#### 2.4. `globalBandwidth` (`number` or `'unbound'`)

The global bandwidth setting. It can be a positive integer or the string `'unbound'`. Defaults to `'unbound'`.

#### 2.5. `taskGroups` (`Array<Object>`)

An array of task group objects, where each object has:

| Property | Type | Description |
|---|---|---|
| `type` | `string` | The type of identifier: `'list'` or `'regex'`. |
| `name` | `string` | The name of the task group, or `'Unnamed Group'` if not specified. |
| `identifiers` | `Array<string>` | An array of task names for `'list'` groups, or a single regex string for `'regex'` groups. |
| `bandwidth` | `number` or `'unbound'` | The concurrency limit for this group. |

**Example Task Group Array:**

```json
[
  {
    "type": "list",
    "name": "Development Team",
    "identifiers": ["Task 1", "Task 2"],
    "bandwidth": 2
  },
  {
    "type": "regex",
    "name": "Unnamed Group",
    "identifiers": ["^Maintenance.+"],
    "bandwidth": "unbound"
  }
]
```

#### 2.6. `errors` (`Array<Object>`)

An array of error and warning objects found during parsing. Each object has:

| Property | Type | Description |
|---|---|---|
| `line` | `number` or `'N/A'` | The line number where the error occurred. `'N/A'` is used for errors that can't be mapped to a single line (e.g., dependency validation). |
| `message` | `string` | A descriptive message about the issue. |
| `type` | `'error'` or `'warning'` | The severity of the issue. Warnings are for non-critical issues (e.g., duplicate definitions). |

**Example Errors Array:**

```json
[
  {
    "line": 15,
    "message": "Duplicate task name \"Task A\". Task names must be unique.",
    "type": "error"
  },
  {
    "line": "N/A",
    "message": "Dependency source task \"Undefined Task\" is not defined.",
    "type": "error"
  }
]
```