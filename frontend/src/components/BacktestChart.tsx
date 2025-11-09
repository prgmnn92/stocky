import { Box, useColorModeValue } from '@chakra-ui/react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
} from 'recharts'

interface BacktestChartProps {
  priceData: Array<{
    ts: string
    close: number
  }>
  signals: Array<{
    ts: string
    action: 'BUY' | 'SELL'
    confidence: number
  }>
}

export default function BacktestChart({ priceData, signals }: BacktestChartProps) {
  const gridColor = useColorModeValue('#e0e0e0', '#333')
  const lineColor = useColorModeValue('#3182ce', '#63b3ed')

  // Merge price data with signals for the chart
  const chartData = priceData.map((price) => {
    const signal = signals.find((s) => s.ts === price.ts)
    return {
      date: new Date(price.ts).toLocaleDateString(),
      fullDate: price.ts,
      price: price.close,
      buySignal: signal && signal.action === 'BUY' ? price.close : null,
      sellSignal: signal && signal.action === 'SELL' ? price.close : null,
      signal: signal ? signal.action : null,
      confidence: signal ? signal.confidence : null,
    }
  })

  // Custom shape for BUY signals (triangle pointing up)
  const BuyDot = (props: any) => {
    const { cx, cy } = props
    const size = 12
    return (
      <g>
        <polygon
          points={`${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`}
          fill="#38a169"
          stroke="white"
          strokeWidth={2}
        />
        <text
          x={cx}
          y={cy - size - 8}
          textAnchor="middle"
          fill="#38a169"
          fontSize={12}
          fontWeight="bold"
        >
          BUY
        </text>
      </g>
    )
  }

  // Custom shape for SELL signals (triangle pointing down)
  const SellDot = (props: any) => {
    const { cx, cy } = props
    const size = 12
    return (
      <g>
        <polygon
          points={`${cx},${cy + size} ${cx - size},${cy - size} ${cx + size},${cy - size}`}
          fill="#e53e3e"
          stroke="white"
          strokeWidth={2}
        />
        <text
          x={cx}
          y={cy + size + 18}
          textAnchor="middle"
          fill="#e53e3e"
          fontSize={12}
          fontWeight="bold"
        >
          SELL
        </text>
      </g>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <Box
        bg={useColorModeValue('white', 'gray.800')}
        p={3}
        borderRadius="md"
        borderWidth="1px"
        borderColor={useColorModeValue('gray.200', 'gray.600')}
        shadow="lg"
      >
        <Box fontWeight="bold" mb={1}>
          {data.date}
        </Box>
        <Box color={lineColor}>Price: ${data.price.toFixed(2)}</Box>
        {data.signal && (
          <>
            <Box
              color={data.signal === 'BUY' ? 'green.500' : 'red.500'}
              fontWeight="bold"
              mt={2}
            >
              {data.signal} Signal
            </Box>
            <Box fontSize="sm" color="gray.500">
              Confidence: {(data.confidence * 100).toFixed(0)}%
            </Box>
          </>
        )}
      </Box>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={450}>
      <ComposedChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" stroke={useColorModeValue('#333', '#ccc')} />
        <YAxis
          stroke={useColorModeValue('#333', '#ccc')}
          domain={['auto', 'auto']}
          tickFormatter={(value) => `$${value.toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="price"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          name="Close Price"
        />
        <Scatter
          dataKey="buySignal"
          fill="#38a169"
          shape={<BuyDot />}
          name="Buy Signal"
        />
        <Scatter
          dataKey="sellSignal"
          fill="#e53e3e"
          shape={<SellDot />}
          name="Sell Signal"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
