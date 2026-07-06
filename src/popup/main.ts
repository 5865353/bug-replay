import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import 'vant/lib/index.css';
import 'virtual:uno.css';
import './styles/global.scss';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
