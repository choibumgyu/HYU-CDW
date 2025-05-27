// types/ChartBaseProps.ts
import * as echarts from "echarts";

export interface ChartBaseProps {
    xAxis: string;
    yAxis: string;
    data: any[];
    setChartInstance: (chart: echarts.ECharts) => void;
}

export interface Bar3dProps extends ChartBaseProps {
    zAxis: string;
}