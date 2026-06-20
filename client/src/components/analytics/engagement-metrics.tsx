import { Card } from "../ui/card";
import { logger } from "../../lib/logger";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface EngagementMetricsProps {
  data: Array<{
    platform: string;
    likes: number;
    comments: number;
    shares: number;
  }>;
}

export function EngagementMetrics({ data }: EngagementMetricsProps) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Engagement por Plataforma</h3>
        <p className="text-sm text-muted-foreground">
          Comparativa de interacciones entre diferentes plataformas
        </p>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="platform" 
              stroke="currentColor"
              fontSize={12}
            />
            <YAxis
              stroke="currentColor"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            <Bar dataKey="likes" fill="hsl(var(--primary))" name="Likes" radius={[4, 4, 0, 0]} />
            <Bar dataKey="comments" fill="hsl(var(--secondary))" name="Comentarios" radius={[4, 4, 0, 0]} />
            <Bar dataKey="shares" fill="hsl(var(--accent))" name="Compartidos" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
