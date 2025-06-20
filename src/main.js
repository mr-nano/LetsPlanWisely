import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// Import and register VueKonva components globally
import VueKonva from 'vue-konva';

const app = createApp(App);
app.use(VueKonva); // Use the VueKonva plugin
app.mount('#app');