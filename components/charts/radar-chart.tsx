"use client";

import { Radar } from "react-chartjs-2";
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function CompetencyRadar() {
  return (
    <Radar
      data={{
        labels: ["Leadership", "Creativity", "Logic", "Communication", "Resilience"],
        datasets: [
          {
            label: "CareerDNA Score",
            data: [82, 76, 91, 74, 80],
            backgroundColor: "rgba(37, 99, 235, 0.2)",
            borderColor: "#2563EB",
            borderWidth: 2,
          },
        ],
      }}
      options={{
        plugins: { legend: { display: false } },
        scales: { r: { suggestedMin: 0, suggestedMax: 100 } },
      }}
    />
  );
}
