# Stocky Frontend

React frontend for the Stocky swing trading signal generator.

## Features

- 📊 **Dashboard** - Overview with key metrics and recent activity
- 🔤 **Symbols Management** - Add, view, and remove trading symbols
- 🎯 **Strategies** - View and toggle trading strategies
- 📈 **Signals** - Filter and view BUY/SELL signals
- 💰 **Positions** - Open and close paper trading positions with P&L tracking

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Chakra UI** - Component library
- **React Router** - Navigation
- **React Query** - Data fetching and caching
- **Axios** - HTTP client
- **date-fns** - Date formatting

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Backend API running on http://localhost:8000

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will run on http://localhost:3000

### Build for Production

```bash
npm run build
```

Output in `dist/` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/         # Reusable components
│   │   └── Layout.tsx     # Main layout with sidebar
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx  # Overview dashboard
│   │   ├── Symbols.tsx    # Symbol management
│   │   ├── Strategies.tsx # Strategy management
│   │   ├── Signals.tsx    # Signals view
│   │   └── Positions.tsx  # Position management
│   ├── services/          # API services
│   │   └── api.ts         # Axios client & API functions
│   ├── hooks/             # Custom React hooks
│   │   └── useApiQueries.ts # React Query hooks
│   ├── types/             # TypeScript types
│   │   └── api.ts         # API model types
│   ├── theme.ts           # Chakra UI theme
│   ├── App.tsx            # Root component
│   └── main.tsx           # Entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Configuration

### Environment Variables

Create `.env` file:

```bash
# API Base URL (optional)
VITE_API_URL=http://localhost:8000
```

If not set, uses `/api` proxy (configured in `vite.config.ts`).

### Vite Proxy

The dev server proxies `/api/*` to `http://localhost:8000/*` by default. This avoids CORS issues during development.

## Pages

### Dashboard (`/`)
- Stats cards: symbols, strategies, signals, positions
- Recent signals table
- Open positions summary
- "Run Daily Job" button

### Symbols (`/symbols`)
- List all active symbols
- Add new symbol (modal)
- Delete symbol (with confirmation)

### Strategies (`/strategies`)
- Card grid of all strategies
- Enable/disable toggle
- View parameters

### Signals (`/signals`)
- Filter by symbol, strategy
- BUY/SELL badges with color coding
- Confidence score progress bars
- Date and price information

### Positions (`/positions`)
- Tabs: Open / Closed
- Open positions with close action
- Closed positions with P&L
- Total P&L calculation
- Open position modal

## API Integration

All API calls go through React Query hooks in `src/hooks/useApiQueries.ts`:

**Queries** (GET):
- `useSymbols()` - Get all symbols
- `useSignals(filters)` - Get signals
- `usePositions(status)` - Get positions
- `useStrategies()` - Get strategies
- `useHealth()` - Health check

**Mutations** (POST/PATCH/DELETE):
- `useCreateSymbol()` - Add symbol
- `useDeleteSymbol()` - Remove symbol
- `useCreatePosition()` - Open position
- `useClosePosition()` - Close position
- `useUpdateStrategy()` - Update strategy
- `useTriggerDaily()` - Run daily job

All mutations include:
- Automatic cache invalidation
- Toast notifications (success/error)
- Loading states

## Development

### Run Dev Server

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

### Static Hosting (Vercel, Netlify, etc.)

1. Build:
```bash
npm run build
```

2. Deploy `dist/` directory

3. Set environment variable:
```
VITE_API_URL=https://your-backend-api.com
```

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Customization

### Theme

Edit `src/theme.ts` to customize colors, fonts, etc.

### Add New Page

1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add nav item in `src/components/Layout.tsx`

### Add New API Endpoint

1. Add TypeScript types in `src/types/api.ts`
2. Add API function in `src/services/api.ts`
3. Add React Query hook in `src/hooks/useApiQueries.ts`

## Troubleshooting

### CORS Errors
- Make sure backend has CORS enabled for `http://localhost:3000`
- Or use the Vite proxy (default)

### API Not Found
- Check backend is running on port 8000
- Verify `VITE_API_URL` or proxy config

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT

---

**Note**: This is the frontend for Stocky. See main [README](../README.md) for full project documentation.
