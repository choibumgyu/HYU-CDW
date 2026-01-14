'use client';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function NumericHistogramChart({
    title,
    labels,
    distribution,
}: {
    title: string;
    labels: string[];
    distribution: number[];
}) {
    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h3 className="font-semibold mb-2">{title}</h3>
            <div className="h-48">
                <Bar
                    data={{
                        labels,
                        datasets: [
                            { label: title, data: distribution, backgroundColor: 'rgba(255,99,132,0.5)' },
                        ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
            </div>
        </div>
    );
}
