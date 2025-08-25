'use client';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

let registered = false;
export function ensureChartJsRegistered() {
    if (registered) return;
    ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
    registered = true;
}
