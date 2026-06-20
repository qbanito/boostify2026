import { Card } from "../ui/card";
import { logger } from "../../lib/logger";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

interface TrendChartProps {
  title: string;
  data: Array<{
    date: string;
    value: number;
  }>;
  description?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function TrendChart({ 
  title, 
  data,
  description,
  valuePrefix = "",
  valueSuffix = ""
}: TrendChartProps) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              stroke="currentColor" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="currentColor"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `${valuePrefix}${value}${valueSuffix}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number) => [`${valuePrefix}${value}${valueSuffix}`, title]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
