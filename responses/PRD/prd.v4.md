Here is the updated Product Requirement Document (PRD), specifically reflecting the enhancement to allow naming of Task Groups for better visual lane identification.

-----

**Product Requirement Document (PRD): Visual Task Scheduler**

Version: 1.3

Date: June 26, 2025

Author: Gemini (as AI assistant, in collaboration with User)

-----

**I. Introduction**

**A. Project Goal:** To create a lightweight, visual task scheduler that empowers users to define tasks, their dependencies, and parallelization limits using a Markdown-based input, and then dynamically visualize the optimal task execution sequence on an interactive canvas.

**B. Vision:** To provide a simple yet powerful tool for individuals and small teams to plan and understand complex task flows. It aims to bridge the gap between simple static diagrams and complex project management software, offering a "configuration-as-code" approach to task scheduling where parallel execution and resource constraints (via parallelization limits) are critical. The tool will emphasize clarity, visual intuition, and ease of definition.

**C. Scope (Minimum Viable Product - MVP):**

  * Define tasks with a unique name, optional description, and duration.
  * Specify Finish-to-Start (FS) dependencies between tasks.
  * Control global maximum parallelization.
  * Define and apply group-specific maximum parallelization using explicit task lists or regex. **Task Groups can optionally be named for better visual identification.**
  * Associate additional key-value information (e.g., Assumptions, Open Questions, Metadata) with tasks, where values can be multi-line bullet points.
  * Visualize the scheduled tasks on an interactive canvas, clearly showing dependencies, relative durations, and parallel execution batches.
  * Provide a Markdown input editor with essential UX features like autocomplete and error highlighting.

**II. Core Features**

**A. Task Definition:**

  * **Syntax:** Tasks will be defined using a Markdown-like single-line syntax, potentially followed by indented key-value pairs. While exact parsing is flexible, the conceptual structure is:
    `Task "[Task Name]" "[Optional Description]" "[Duration]" "[Optional list of dependent tasks]"`
    *Example:* `Task "Develop UI" "Implement the frontend interface" "M" "Code Backend"`
    *Example with multiple inline dependencies:* `Task "Final Testing" "Perform full system tests" "L" "Develop UI, Deploy Backend"`

  * **Additional Task Details (Key-Value Pairs):**

      * Users can add supplementary information to tasks using indented key-value pairs directly below the task definition line.
      * **Syntax:**
        ```markdown
        Key (single sentence, followed by a colon):
            - Value (multi-line bullet points, indented further)
            - Another value bullet point
            - Yet another value bullet point
        ```
      * **Example:**
        ```markdown
        Task "Develop UI" "Implement frontend" "M" "Code Backend"
            Assumptions:
                - Some assumption
                - Some other assumption
                - Something else
            Open questions:
                - Some open question
                - Some other open question
                - Some more open question
            Metadata:
                - Any sentence
                - Any other sentence
        ```
      * **Key:** Must be a single line of text (e.g., "Assumptions", "Open questions", "Metadata").
      * **Values:** Can be one or more bullet points. Each bullet point starts with a hyphen (`-`) followed by a space, and can contain a single line of text.
      * **Indentation:** The key must be indented (e.g., by a tab or 4 spaces) relative to the `Task` line. Each bullet point value must be further indented (e.g., by another tab or 4 spaces) relative to its corresponding key. Consistent indentation will be crucial for parsing.
      * **Flexibility:** Users can define any custom keys. There are no predefined keywords for these key-value pairs (e.g., "Assumptions" is just an example key, not a reserved word).

  * **Task Name:**

      * Must be a unique string within the entire project.
      * Serves as the primary identifier for all references (dependencies, task groups).
      * Case-sensitive matching for now, unless specified otherwise later.

  * **Optional Description:** A string for additional context. If long, it will be trimmed in the visualization.

  * **Duration:**

      * **Numerical Value:** Direct integer or decimal (e.g., `5`, `7.5`). These represent abstract "person-units."
      * **Predefined Labels:** `XS`, `S`, `M`, `L`, `XL`, `XXL`.
      * **Configurable Label Values:** Users can define the numerical value for each label using syntax like:
        `L:10`
        `XL:15`
        These definitions should ideally be placed at the top of the Markdown input or in a dedicated configuration section. If a label is used without a numerical definition, it should be treated as an error.

  * **Comments:** Any text after a designated comment marker (e.g., `#` or `//`) on a task line will be ignored by the parser but retained in the Markdown. (Actual comment syntax to be decided during technical design).

**B. Dependency Management:**

  * **Type:** All dependencies are assumed to be Finish-to-Start (FS). This means the preceding task must be fully completed before the dependent task can begin.
  * **Syntax Options:**
      * **Inline (within task definition):** Task B can specify "Task A" in its optional dependency list.
      * **Explicit Statements:**
          * `"[Name of the task A]" should happen before "[Name of another task B]"` (translates to Task A -\> Task B)
          * `"[Name of the task B]" depends on "[Name of another task A]"` (translates to Task A -\> Task B)
          * `"[Name of the task B]" should happen after "[Name of another task A]"` (translates to Task A -\> Task B)
  * **Ambiguity Resolution:** The parser must identify all dependency relationships from these different syntaxes and build a comprehensive dependency graph.
  * **Error Handling:**
      * **Undefined Task Names:** If a dependency refers to a task name that has not been defined, an error will be flagged.
      * **Circular Dependencies:** The system must detect and report circular dependencies, as these prevent a valid schedule from being generated. The visualization should indicate the problematic tasks.

**C. Parallelization Control:**

  * **Purpose:** To manage the maximum number of tasks that can run concurrently at any given time.
  * **Global Setting:** Applies as the **default parallelization limit for all tasks not explicitly assigned to a `Task Group`**.
      * **Syntax:** `Global Bandwidth: ["unbound"|number]`
      * **Default:** `unbound` (if this directive is absent). `unbound` implies that as many tasks as possible will run in parallel, limited only by dependencies.
      * **Behavior:** Tasks that do not belong to any `Task Group` (defined below) will adhere to this `Global Bandwidth` limit.
  * **Task Group Specific Setting:** Allows finer-grained control over specific sets of tasks.
      * **Syntax:**
          * `Task Group "[Group Name]" ["Task name 1", "Task name 2", ...] bandwidth: ["unbound"|number]`
          * `Task Group "[Group Name]" /regex to match task names/ bandwidth: ["unbound"|number]`
          * **Note:** The `"[Group Name]"` is optional. If not provided, a default name will be internally generated (e.g., based on the first few identifiers or a generic "Unnamed Group") for internal processing and visual lane identification. This name primarily serves as the `visualLaneId` and for clarity in messages and the visualization.
      * **Application:** The specified bandwidth applies only to tasks listed or matched within that group.
      * **Precedence:** If a task belongs to multiple task groups with conflicting `bandwidth` settings, the last-defined `Task Group` directive in the Markdown that affects that task will take precedence. This behavior will be explicitly communicated in an error/warning message.
  * **Scheduling Logic:**
      * The core scheduling engine will build a Directed Acyclic Graph (DAG) from tasks and dependencies.
      * It will then calculate optimal start times for each task, respecting dependencies and the active parallelization limit (either the task group's specific limit, or the `Global Bandwidth` if no specific group applies).
      * When a `number` is specified for bandwidth, the scheduler will create "batches" of tasks, ensuring no more than `number` tasks from the affected group (or globally for un-grouped tasks) are running concurrently.

**III. User Interface (UI) / User Experience (UX)**

**A. Layout:** A two-panel, side-by-side layout.

  * **Left Panel (Input/Markdown Editor):**
      * **Purpose:** Primary input area for users to define tasks and rules.
      * **Features:**
          * Syntax highlighting for recognized keywords (e.g., "Task", "Task Group", "bandwidth", "Global Bandwidth").
          * **Indentation Support:** The editor should facilitate easy indentation for the new key-value pairs (e.g., Tab key inserts spaces/tabs, Shift+Tab outdents).
          * **Autocomplete:** As the user types task names (especially in dependency or `Task Group` definitions), a dynamic dropdown or inline suggestion should appear, listing existing task names.
          * **Error Indication:** Invalid Markdown syntax (e.g., missing quotes, incorrect keywords, inconsistent indentation for key-value pairs), undefined task names, or conflicting settings will be clearly highlighted in the editor (e.g., red underline, wavy line).
  * **Right Panel (Visualization Canvas):**
      * **Purpose:** Displays the real-time visual representation of the scheduled tasks.

**B. Input Mechanism:**

  * **Direct Markdown Input:** Users type directly into the left panel.
  * **Live Rendering:** The visualization on the right panel should update dynamically (or with minimal delay) as the user types, providing immediate feedback on their changes.

**C. Visualization Panel:**

  * **Type:** Interactive canvas.
  * **Time Progression:** Tasks will be laid out horizontally from left to right, representing progression through abstract time units. The horizontal length of each task box will be proportional to its estimated duration.
  * **Task Box Representation:**
      * **Shape:** Rectangular boxes with rounded corners.
      * **Contents:** Clearly display the Task Name, a trimmed version of the Optional Description (if provided and long), and the Duration Estimate (e.g., "M", "5").
      * **Information Toggle/Expansion (Future Consideration):** For the MVP, the additional key-value pair information (Assumptions, Open Questions, Metadata) will **not** be directly visible on the main task box to maintain clarity. However, the system should parse and store this information. A future enhancement could allow clicking on a task box to expand a detailed view that displays these key-value pairs.
      * **No Status:** Task status (active, done) is not part of the MVP visualization.
  * **Dependency Lines:** Simple solid arrows (Finish-to-Start) connecting the right edge of a preceding task's box to the left edge of a dependent task's box. Arrows should avoid excessive overlap or sharp angles for readability.
  * **Parallelization Visualization:**
      * Tasks running concurrently (either in an "unbound" scenario or within a "bounded" batch) will be horizontally aligned.
      * Independent task flows or subsequent batches (due to parallelization limits) will appear in separate horizontal "rows" or "tracks" **based on their assigned `Task Group` (or a "global" default track)**. This ensures visual separation of different teams/resource pools.
      * **Visual Ordering:** The layout algorithm should prioritize maintaining the relative vertical order of tasks as they appear in the Markdown input where possible, especially for tasks that are independent or start new parallel flows. This helps users map their input to the visual output.
  * **Interactivity:**
      * **Panning:** Users must be able to drag the canvas to view different parts of the diagram.
      * **Zooming:** Users must be able to zoom in and out of the canvas to adjust the level of detail.
  * **Aesthetics:** Clean, minimalistic design, similar to Mermaid diagrams or Obsidian Canvas, focusing on clarity and readability.

**D. Error Reporting (UI specific):**

  * A dedicated message area (e.g., a footer bar or a small overlay) will display warnings and errors (e.g., "Circular dependency detected: Task A -\> Task B -\> Task A", "Undefined task 'NonExistentTask' referenced in dependency", "Inconsistent indentation for task details"). These messages should be actionable.

**IV. Technical Considerations (High-Level)**

**A. Markdown Parsing:**

  * A robust parser implementation will be required to accurately extract task definitions, duration values/labels, explicit and inline dependencies, global bandwidth, task group bandwidth directives (including their optional names), and the new indented key-value pairs with multi-line bullet points.
  * Needs to handle variations in whitespace and optional components. **Crucially, the parser must correctly interpret indentation levels to associate key-value pairs with their parent tasks.**
  * Essential for identifying and reporting parsing errors (e.g., malformed syntax, unquoted strings, inconsistent indentation).

**B. Graph/Scheduling Engine:**

  * **Graph Construction:** Converts parsed tasks and dependencies into a Directed Acyclic Graph (DAG) for efficient traversal and scheduling.
  * **Dependency Resolution:** Ensures all dependencies are valid and detects circular dependencies.
  * **Scheduling Algorithm:**
      * Implements a critical path method or similar scheduling logic.
      * Incorporates the global and group-specific parallelization limits as constraints.
      * Determines the earliest possible start time for each task while respecting both dependencies and bandwidth constraints.
      * Calculates the total duration of the project.

**C. Visualization Engine:**

  * **Technology Choice:** A JavaScript-based library suitable for dynamic, interactive diagramming (e.g., D3.js for custom SVG rendering, Konva.js for Canvas rendering, or potentially a diagramming library like GoJS or JointJS if complexity warrants, though starting simple is preferred).
  * **Layout Algorithm:** Responsible for arranging task boxes and drawing dependency lines in an aesthetically pleasing and readable manner, adhering to the horizontal time progression, proportional task lengths, and respecting vertical ordering preferences based on input. **Must ensure tasks belonging to different `visualLaneId`s are placed on visually distinct horizontal tracks.**
  * **Interactivity Implementation:** Handles pan and zoom gestures efficiently, maintaining performance with a growing number of tasks.

**D. Data Storage:**

  * **Client-Side:** For MVP, all data will reside in the user's browser.
  * **Persistence:** Utilizes `localStorage` to persist the Markdown input across browser sessions, ensuring that a user's work is not lost if they close and reopen the tab.
  * **Export/Import (Manual):** Users can save their work by copying the Markdown text from the left panel. To "load" work, they paste the Markdown back into the editor.

**V. Out of Scope (for initial version)**

  - User authentication, account management, or multi-user collaboration features.
  - Advanced dependency types (e.g., Start-to-Start, Finish-to-Finish, Start-to-Finish, lead/lag times).
  - Detailed resource allocation beyond simple concurrent task count (e.g., named resources, resource calendars).
  - Integration with external calendars (Google Calendar, Outlook) or existing project management tools (Jira, Asana).
  - Reporting or analytics dashboards (e.g., burndown charts, resource utilization reports).
  - Dedicated export options beyond manual copy (e.g., PDF, image formats like PNG/SVG, Mermaid code, JSON).
  - Real-time collaborative editing.
  - Undo/Redo functionality specific to editor content (browser's native undo/redo will be available).
  - Direct drag-and-drop manipulation of tasks or dependencies on the canvas; all changes are made via Markdown input.
  - Definition of "person-unit" meaning; it remains an abstract unit for this MVP.
  - **Direct visual representation of the key-value pair details (Assumptions, Open Questions, Metadata) on the main visualization canvas.** This will be a future consideration.

**VI. Future Considerations / Enhancements**

  - Dedicated buttons for saving and loading `.md` files.
  - Export to image formats (PNG, SVG) or specific diagramming syntaxes (Mermaid, PlantUML).
  - More sophisticated error messaging with visual cues on the canvas (e.g., highlighting tasks involved in a circular dependency).
  - Ability to configure additional unit types (e.g., `days`, `hours`).
  - **Interactive viewing/expanding of key-value pair details for a task, perhaps in a pop-up or sidebar when a task is clicked on the canvas.**
  - Interactive editing of task properties directly on the canvas, with changes reflected back in the Markdown (round-trip editing).
  - Support for different types of dependency relationships (SS, FF, SF).
  - Visual "walkthrough" or simulation mode to see how tasks progress over time.
  - Theming (dark/light mode).
  - Performance optimizations for very large task sets.
  - Keyboard shortcuts for common editor actions.