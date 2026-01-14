package com.yourcompany.cdw.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ChartDataController {

    @PostMapping("/chart-data")
    public String getChartData(@RequestBody ChartDataRequest request) {
        // 받은 파라미터를 이어붙여 문자열로 반환
        return String.format("Data Type: %s, X Axis: %s, Y Axis: %s, Chart Type: %s",
                request.getDataType(), request.getXAxis(), request.getYAxis(), request.getChartType());
    }
}

class ChartDataRequest {
    private String dataType;
    private String xAxis;
    private String yAxis;
    private String chartType;

    // Getters and Setters
    public String getDataType() { return dataType; }
    public void setDataType(String dataType) { this.dataType = dataType; }
    public String getXAxis() { return xAxis; }
    public void setXAxis(String xAxis) { this.xAxis = xAxis; }
    public String getYAxis() { return yAxis; }
    public void setYAxis(String yAxis) { this.yAxis = yAxis; }
    public String getChartType() { return chartType; }
    public void setChartType(String chartType) { this.chartType = chartType; }
}