import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register necessary chart components explicitly.
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const testChartData = {
  labels: ["A", "B", "C"],
  datasets: [
    {
      label: "Test Chart",
      data: [1, 2, 3],
      backgroundColor: "rgba(255, 0, 0, 0.6)",
    },
  ],
};

const TestChart: React.FC = () => {
  return (
    <div style={{ width: "600px", height: "400px", margin: "0 auto" }}>
      <Bar data={testChartData} />
    </div>
  );
};

export default TestChart;
