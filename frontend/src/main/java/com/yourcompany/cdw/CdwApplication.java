package com.yourcompany.cdw;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CdwApplication {
    public static void main(String[] args) {
        SpringApplication.run(CdwApplication.class, args);
    }
async function fetchChartData(dataType: string, xAxis: string, yAxis: string, chartType: string) {
  const response = await fetch('/api/chart-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dataType, xAxis, yAxis, chartType }),
  });
  
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  
  const data = await response.text(); // 문자열 응답을 받습니다.
  return { message: data }; // 객체 형태로 반환합니다.
}
interface ChartData {
  message: string;
}

const CustomBarChart: React.FC<{ data: ChartData }> = ({ data }) => {
  return <div>{data.message}</div>;
};
}