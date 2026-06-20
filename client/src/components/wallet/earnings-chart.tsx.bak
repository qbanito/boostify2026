import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Wallet, ArrowUpRight, ArrowDownRight, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

interface EarningsChartProps {
  userId: number;
  days?: number;
}

interface DailyEarning {
  date: string;
  earnings: number;
  sales: number;
}

interface EarningsData {
  dailyEarnings: DailyEarning[];
  totalEarnings: number;
  totalSales: number;
  period: string;
}

interface WalletBalance {
  balance: number;
  totalEarnings: number;
  totalSpent: number;
  currency: string;
}

interface SalesStats {
  totalSales: number;
  pendingSales: number;
  totalRevenue: number;
  totalEarnings: number;
  topProduct: {
    name: string;
    sales: number;
    earnings: number;
  } | null;
}

export function EarningsChart({ userId, days = 30 }: EarningsChartProps) {
  // Obtener historial de ganancias
  const { data: earningsData, isLoading: loadingEarnings } = useQuery<{ success: boolean; data: EarningsData }>({
    queryKey: ['/api/artist-wallet/earnings-history', userId, days],
    enabled: !!userId,
  });

  // Obtener balance del wallet
  const { data: walletData, isLoading: loadingWallet } = useQuery<{ success: boolean; wallet: WalletBalance }>({
    queryKey: ['/api/artist-wallet/balance', userId],
    enabled: !!userId,
  });

  // Obtener estadísticas de ventas
  const { data: statsData, isLoading: loadingStats } = useQuery<{ success: boolean; stats: SalesStats }>({
    queryKey: ['/api/artist-wallet/sales-stats', userId],
    enabled: !!userId,
  });

  if (loadingEarnings || loadingWallet || loadingStats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const earnings = earningsData?.data;
  const wallet = walletData?.wallet;
  const stats = statsData?.stats;

  // Formatear datos para el gráfico
  const chartData = earnings?.dailyEarnings.map(item => ({
    date: new Date(item.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    ganancias: item.earnings,
    ventas: item.sales,
  })) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: wallet?.currency || 'USD',
    }).format(value);
  };

  // Calcular tendencia
  const calculateTrend = () => {
    if (!chartData || chartData.length < 2) return 0;
    const recent = chartData.slice(-7).reduce((sum, item) => sum + item.ganancias, 0) / 7;
    const previous = chartData.slice(-14, -7).reduce((sum, item) => sum + item.ganancias, 0) / 7;
    if (previous === 0) return 0;
    return ((recent - previous) / previous) * 100;
  };

  const trend = calculateTrend();

  return (
    <div className="space-y-4">
      {/* Estadísticas principales con animación */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          data-testid="card-wallet-balance"
          className="bg-gradient-to-br from-green-500/10 to-emerald-600/5 rounded-lg p-2.5 sm:p-3 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10"
        >
          <div className="flex items-center justify-between mb-1.5">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            <div className="bg-green-500/20 rounded px-1.5 py-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold text-green-400">DISPONIBLE</span>
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-white mb-0.5" data-testid="text-balance">
            {formatCurrency(wallet?.balance || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate">
            Total: {formatCurrency(wallet?.totalEarnings || 0)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          data-testid="card-period-earnings"
          className="bg-gradient-to-br from-blue-500/10 to-cyan-600/5 rounded-lg p-2.5 sm:p-3 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10"
        >
          <div className="flex items-center justify-between mb-1.5">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            {trend > 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-400" />
            ) : trend < 0 ? (
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            ) : null}
          </div>
          <div className="text-base sm:text-lg font-bold text-white mb-0.5" data-testid="text-period-earnings">
            {formatCurrency(earnings?.totalEarnings || 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate">
            {earnings?.totalSales || 0} ventas • {days}d
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          data-testid="card-total-sales"
          className="bg-gradient-to-br from-purple-500/10 to-pink-600/5 rounded-lg p-2.5 sm:p-3 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
        >
          <div className="flex items-center justify-between mb-1.5">
            <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
            <div className="bg-purple-500/20 rounded px-1.5 py-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold text-purple-400">{stats?.pendingSales || 0}</span>
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-white mb-0.5" data-testid="text-total-sales">
            {stats?.totalSales || 0}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate">
            Ventas completadas
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          data-testid="card-top-product"
          className="bg-gradient-to-br from-yellow-500/10 to-orange-600/5 rounded-lg p-2.5 sm:p-3 border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10"
        >
          <div className="flex items-center justify-between mb-1.5">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
            <div className="bg-yellow-500/20 rounded px-1.5 py-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold text-yellow-400">TOP</span>
            </div>
          </div>
          <div className="text-xs sm:text-sm font-bold text-white mb-0.5 truncate" data-testid="text-top-product">
            {stats?.topProduct?.name || 'Sin ventas'}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate">
            {stats?.topProduct ? `${stats.topProduct.sales} unidades` : 'N/A'}
          </p>
        </motion.div>
      </div>

      {/* Gráficos de tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de área - Ganancias */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          data-testid="card-earnings-chart"
          className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all duration-300"
        >
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Tendencia de Ganancias
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Últimos {days} días • Comisión 30%
            </p>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGanancias" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  stroke="#4b5563"
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(value) => `$${value}`}
                  stroke="#4b5563"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Ganancias']}
                />
                <Area 
                  type="monotone" 
                  dataKey="ganancias" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#colorGanancias)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <p className="text-sm">No hay datos de ganancias</p>
            </div>
          )}
        </motion.div>

        {/* Gráfico de barras - Ventas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all duration-300"
        >
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
              Volumen de Ventas
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Cantidad de productos vendidos
            </p>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  stroke="#4b5563"
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  stroke="#4b5563"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [value, 'Ventas']}
                />
                <Bar 
                  dataKey="ventas" 
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <p className="text-sm">No hay datos de ventas</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Indicador de tendencia */}
      {chartData.length >= 14 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className={`rounded-xl p-4 border ${
            trend > 0 
              ? 'bg-gradient-to-r from-green-500/10 to-emerald-600/5 border-green-500/30' 
              : trend < 0
              ? 'bg-gradient-to-r from-red-500/10 to-rose-600/5 border-red-500/30'
              : 'bg-gradient-to-r from-gray-500/10 to-gray-600/5 border-gray-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {trend > 0 ? (
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-400" />
                </div>
              ) : trend < 0 ? (
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-400" />
                </div>
              ) : (
                <div className="p-2 bg-gray-500/20 rounded-lg">
                  <DollarSign className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-400">Tendencia (últimas 2 semanas)</p>
                <p className={`text-2xl font-bold ${
                  trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                {trend > 0 ? '¡Excelente! Tus ventas están creciendo' : 
                 trend < 0 ? 'Tus ventas han disminuido' :
                 'Tus ventas se mantienen estables'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
