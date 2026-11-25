import { createWebHistory } from 'vue-router';
import { bootstrap } from './bootstrap';
import './style.css';

bootstrap(createWebHistory()).app.mount('#app');
