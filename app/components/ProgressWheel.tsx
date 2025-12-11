type BigProgressWheelProps = {
  value: number;
  size?: number;
  stroke?: number;
};

export function BigProgressWheel({
  value,
  size = 100,
  stroke = 8,
}: BigProgressWheelProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          stroke="rgba(255,255,255,0.2)"
          fill="transparent"
          strokeWidth={stroke}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />

        <circle
          stroke="#00e0ff"
          fill="transparent"
          strokeWidth={stroke}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <text
          x="50%"
          y="50%"
          fill="white"
          stroke="black"
          strokeWidth="0.5"
          paintOrder="stroke"
          fontSize={size * 0.18}
          fontWeight="600"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        >
          {value}%
        </text>
      </svg>
    </div>
  );
}
