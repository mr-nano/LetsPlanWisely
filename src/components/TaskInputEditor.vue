<template>
  <div class="relative flex flex-col h-full">
    <textarea
      v-model="markdownInput"
      @input="onInput"
      class="flex-grow p-3 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-gray-50 text-gray-900 leading-relaxed"
      placeholder='Define tasks, dependencies, and parallelization limits here. Example:
Task "Develop UI" "Implement frontend" "M" "Code Backend"
Task "Code Backend" "Develop API and DB" "L"
Global Bandwidth: 2'
    ></textarea>
    <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
      </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

// Reactive variable to hold the Markdown content
const markdownInput = ref('');

// A simple debounce function to limit updates (optional but good for performance)
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Emitting the input for the parent component (App.vue) to process
const emit = defineEmits(['update:markdown']);

// Debounced function to emit the input
const emitDebouncedInput = debounce(() => {
  emit('update:markdown', markdownInput.value);
}, 300); // Debounce by 300ms

const onInput = () => {
  // We'll eventually integrate parsing and error flagging here
  emitDebouncedInput();
};

// For now, let's simulate some initial content
markdownInput.value = `Task "Develop UI" "Implement frontend" "M" "Code Backend"
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

// In a real scenario, you might want to load this from localStorage here
// watch(markdownInput, (newValue) => {
//   localStorage.setItem('task-scheduler-markdown', newValue);
// }, { immediate: true }); // Save to localStorage on initial load and changes

// You might load from localStorage on mount:
// onMounted(() => {
//   const savedInput = localStorage.getItem('task-scheduler-markdown');
//   if (savedInput) {
//     markdownInput.value = savedInput;
//   }
// });
</script>