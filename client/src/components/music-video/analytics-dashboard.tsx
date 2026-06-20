import { Card } from "../ui/card";
import { logger } from "../../lib/logger";
import { ScrollArea } from "../ui/scroll-area";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TimelineClip } from "./timeline-editor";
import { 
  Activity,
  Clock,
  Camera,
  Palette,
  Waves,
  Gauge
} from "lucide-react";

interface AnalyticsDashboardProps {
  clips?: TimelineClip[];
  audioBuffer?: AudioBuffer | null;
  duration?: number;
}

export function AnalyticsDashboard({ 
  clips = [],
  audioBuffer,
  duration = 0
}: AnalyticsDashboardProps) {
  // Calcular estadísticas de los tipos de planos
  const shotTypeStats = clips.reduce((acc, clip) => {
    const type = clip.shotType || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const shotTypeData = Object.entries(shotTypeStats).map(([name, value]) => ({
    name,
    value
  }));

  // Calcular distribución de duraciones
  const durationDistribution = clips.map(clip => ({
    id: clip.id,
    duration: clip.duration
  }));

  // Colores para los gráficos
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

  // Calcular métricas generales
  const totalShots = clips.length;
  const averageShotDuration = totalShots > 0 ? duration / totalShots : 0;
  const longestShot = clips.length > 0 ? Math.max(...clips.map(c => c.duration)) : 0;
  const shortestShot = clips.length > 0 ? Math.min(...clips.map(c => c.duration)) : 0;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Activity className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Análisis y Métricas</h2>
          <p className="text-sm text-muted-foreground">
            Estadísticas detalladas del video musical
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Métricas Generales */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Métricas Generales</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Duración Total</span>
              </div>
              <p className="text-2xl font-bold mt-2">{duration.toFixed(2)}s</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Total de Planos</span>
              </div>
              <p className="text-2xl font-bold mt-2">{totalShots}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Duración Media</span>
              </div>
              <p className="text-2xl font-bold mt-2">{averageShotDuration.toFixed(2)}s</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Rango de Duración</span>
              </div>
              <p className="text-sm mt-2">
                {shortestShot.toFixed(1)}s - {longestShot.toFixed(1)}s
              </p>
            </Card>
          </div>
        </div>

        {/* Distribución de Tipos de Plano */}
        {clips.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tipos de Plano</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shotTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => 
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {shotTypeData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Distribución de Duraciones */}
        {clips.length > 0 && (
          <div className="col-span-2 space-y-4">
            <h3 className="text-lg font-semibold">Distribución de Duraciones</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="id" label={{ value: 'ID del Plano', position: 'bottom' }} />
                  <YAxis label={{ value: 'Duración (s)', angle: -90, position: 'left' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)}s`, 'Duración']}
                  />
                  <Bar dataKey="duration" fill="#FF6B6B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Análisis de Audio */}
        {audioBuffer && (
          <div className="col-span-2 space-y-4">
            <h3 className="text-lg font-semibold">Análisis de Audio</h3>
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Sample Rate</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {(audioBuffer.sampleRate / 1000).toFixed(1)} kHz
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Canales</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {audioBuffer.numberOfChannels}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Duración</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {audioBuffer.duration.toFixed(2)}s
                </p>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}