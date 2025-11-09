import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  VStack,
  HStack,
  Heading,
  Button,
  Text,
  Input,
  Container,
  useColorModeValue,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Grid,
  Card,
  CardBody,
} from '@chakra-ui/react'
import { FiArrowLeft } from 'react-icons/fi'
import { format, subDays } from 'date-fns'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
} from 'recharts'
import * as api from '@/services/api'
import type { PriceBar } from '@/types/api'

interface ChartData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  displayDate: string
}

export default function SymbolDetail() {
  const { symbol } = useParams<{ symbol: string }>()
  const navigate = useNavigate()

  const [priceData, setPriceData] = useState<PriceBar[]>([])
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Date range - default to last 30 days
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  useEffect(() => {
    if (symbol) {
      fetchPriceData()
    }
  }, [symbol])

  const fetchPriceData = async () => {
    if (!symbol) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await api.getPrices(symbol, fromDate, toDate)
      setPriceData(response.data)

      // Transform data for chart
      const transformed = response.data.map((bar) => ({
        date: bar.ts,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        displayDate: format(new Date(bar.ts), 'MMM dd'),
      }))

      setChartData(transformed)
    } catch (err) {
      console.error('Failed to fetch price data:', err)
      setError('Failed to load price data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateRangeChange = () => {
    fetchPriceData()
  }

  // Format large numbers for Y-axis (Volume)
  const formatVolumeYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  // Format price for Y-axis
  const formatPriceYAxis = (value: number) => {
    return `$${value.toFixed(2)}`
  }

  // Calculate KPIs
  const calculateKPIs = () => {
    if (chartData.length === 0) {
      return {
        startPrice: 0,
        endPrice: 0,
        priceChange: 0,
        percentChange: 0,
        highPrice: 0,
        lowPrice: 0,
        avgVolume: 0,
      }
    }

    const startPrice = chartData[0].close
    const endPrice = chartData[chartData.length - 1].close
    const priceChange = endPrice - startPrice
    const percentChange = (priceChange / startPrice) * 100

    const highPrice = Math.max(...chartData.map((d) => d.high))
    const lowPrice = Math.min(...chartData.map((d) => d.low))
    const avgVolume = chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length

    return {
      startPrice,
      endPrice,
      priceChange,
      percentChange,
      highPrice,
      lowPrice,
      avgVolume,
    }
  }

  const kpis = calculateKPIs()

  // Custom candlestick rendering function
  const CandlestickBar = (props: any) => {
    const { x, y, width, height, payload } = props
    const isPositive = payload.close >= payload.open

    const bodyHeight = Math.abs(y - (y + height))
    const bodyY = isPositive ? y + height : y

    const wickTop = Math.min(payload.high, payload.low)
    const wickBottom = Math.max(payload.high, payload.low)

    return (
      <g>
        {/* Wick */}
        <line
          x1={x + width / 2}
          y1={wickTop}
          x2={x + width / 2}
          y2={wickBottom}
          stroke={isPositive ? '#48BB78' : '#F56565'}
          strokeWidth={1}
        />
        {/* Body */}
        <rect
          x={x}
          y={bodyY}
          width={width}
          height={bodyHeight}
          fill={isPositive ? '#48BB78' : '#F56565'}
          stroke={isPositive ? '#48BB78' : '#F56565'}
        />
      </g>
    )
  }

  return (
    <Container maxW="container.xl" py={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <HStack>
            <Button leftIcon={<FiArrowLeft />} onClick={() => navigate('/symbols')} variant="ghost">
              Zurück
            </Button>
            <Heading size="lg">{symbol}</Heading>
          </HStack>
        </HStack>

        {/* Date Range Picker */}
        <Card>
          <CardBody>
            <HStack spacing={4}>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Von Datum
                </Text>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate}
                />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1} fontWeight="medium">
                  Bis Datum
                </Text>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </Box>
              <Button
                colorScheme="green"
                onClick={handleDateRangeChange}
                alignSelf="flex-end"
                isLoading={isLoading}
              >
                Aktualisieren
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* KPIs */}
        {!isLoading && chartData.length > 0 && (
          <Grid templateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4}>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Preisänderung</StatLabel>
                  <StatNumber color={kpis.priceChange >= 0 ? 'green.500' : 'red.500'}>
                    ${kpis.priceChange.toFixed(2)}
                  </StatNumber>
                  <StatHelpText>
                    <StatArrow type={kpis.priceChange >= 0 ? 'increase' : 'decrease'} />
                    {kpis.percentChange.toFixed(2)}%
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Periodenhoch</StatLabel>
                  <StatNumber>${kpis.highPrice.toFixed(2)}</StatNumber>
                  <StatHelpText>Höchstpreis</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Periodentief</StatLabel>
                  <StatNumber>${kpis.lowPrice.toFixed(2)}</StatNumber>
                  <StatHelpText>Tiefstpreis</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Ø Volumen</StatLabel>
                  <StatNumber>{(kpis.avgVolume / 1000000).toFixed(2)}M</StatNumber>
                  <StatHelpText>Tagesdurchschnitt</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Startpreis</StatLabel>
                  <StatNumber>${kpis.startPrice.toFixed(2)}</StatNumber>
                  <StatHelpText>{format(new Date(fromDate), 'dd. MMM')}</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>Endpreis</StatLabel>
                  <StatNumber>${kpis.endPrice.toFixed(2)}</StatNumber>
                  <StatHelpText>{format(new Date(toDate), 'dd. MMM')}</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </Grid>
        )}

        {/* Chart */}
        <Card>
          <CardBody>
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                Tägliches Preisdiagramm
              </Text>

              {isLoading ? (
                <Box textAlign="center" py={20}>
                  <Spinner size="xl" color="green.500" />
                  <Text mt={4} color="gray.500">
                    Lade Preisdaten...
                  </Text>
                </Box>
              ) : error ? (
                <Box textAlign="center" py={20}>
                  <Text color="red.500">{error}</Text>
                </Box>
              ) : chartData.length === 0 ? (
                <Box textAlign="center" py={20}>
                  <Text color="gray.500">Keine Preisdaten für diesen Zeitraum verfügbar</Text>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 12, fill: 'rgba(255, 255, 255, 0.9)' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="price"
                      domain={[(dataMin: number) => dataMin - 5, (dataMax: number) => dataMax + 5]}
                      tick={{ fontSize: 12, fill: 'rgba(255, 255, 255, 0.9)' }}
                      tickFormatter={formatPriceYAxis}
                      label={{ value: 'Preis ($)', angle: -90, position: 'insideLeft', fill: 'rgba(255, 255, 255, 0.9)' }}
                    />
                    <YAxis
                      yAxisId="volume"
                      orientation="right"
                      tick={{ fontSize: 12, fill: 'rgba(255, 255, 255, 0.9)' }}
                      tickFormatter={formatVolumeYAxis}
                      label={{ value: 'Volumen', angle: 90, position: 'insideRight', fill: 'rgba(255, 255, 255, 0.9)' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <Box bg={bgColor} p={3} borderRadius="md" borderWidth="1px">
                              <Text fontWeight="bold" mb={2}>
                                {format(new Date(data.date), 'MMM dd, yyyy')}
                              </Text>
                              <VStack align="start" spacing={1} fontSize="sm">
                                <Text>Eröffnung: ${data.open.toFixed(2)}</Text>
                                <Text>Hoch: ${data.high.toFixed(2)}</Text>
                                <Text>Tief: ${data.low.toFixed(2)}</Text>
                                <Text>Schluss: ${data.close.toFixed(2)}</Text>
                                <Text>Volumen: {(data.volume / 1000000).toFixed(2)}M</Text>
                              </VStack>
                            </Box>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      fill="#CBD5E0"
                      opacity={0.3}
                      barSize={2}
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke="#48BB78"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Box>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  )
}
