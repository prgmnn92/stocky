# Frontend Implementation Guide

Complete guide for the Stocky React frontend.

---

## 🎉 **What Was Built**

A complete, production-ready React frontend with Chakra UI that integrates seamlessly with the FastAPI backend.

### **Features Implemented**

✅ **Dashboard**
- Real-time health status indicator
- 4 stats cards (symbols, strategies, signals, positions)
- Recent signals table with color-coded BUY/SELL badges
- Open positions summary
- One-click "Run Daily Job" button

✅ **Symbols Management**
- Table view of all symbols
- Add symbol modal with validation
- Delete with confirmation dialog
- Status badges (Active/Inactive)

✅ **Strategies Management**
- Card grid layout
- Enable/disable toggle switches
- Parameter display
- Real-time updates

✅ **Signals View**
- Advanced filtering (symbol, strategy, limit)
- Color-coded action badges (Green=BUY, Red=SELL)
- Confidence progress bars
- Date and price information
- Responsive table

✅ **Positions Management**
- Tabbed interface (Open/Closed)
- Open position modal with autocomplete
- Close position with P&L calculation
- Real-time total P&L
- Execution history

---

## 📁 **Project Structure**

```
frontend/
├── src/
│   ├── components/
│   │   └── Layout.tsx              # Main layout with sidebar navigation
│   ├── pages/
│   │   ├── Dashboard.tsx          # Overview dashboard
│   │   ├── Symbols.tsx            # Symbol CRUD
│   │   ├── Strategies.tsx         # Strategy management
│   │   ├── Signals.tsx            # Signals with filtering
│   │   └── Positions.tsx          # Position tracking
│   ├── services/
│   │   └── api.ts                 # Axios client + API functions
│   ├── hooks/
│   │   └── useApiQueries.ts       # React Query hooks
│   ├── types/
│   │   └── api.ts                 # TypeScript types
│   ├── theme.ts                   # Chakra UI dark theme
│   ├── App.tsx                    # Router setup
│   └── main.tsx                   # Entry point
├── public/                         # Static assets
├── index.html                      # HTML template
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite config (with proxy)
├── .eslintrc.cjs                   # ESLint config
├── .gitignore                      # Git ignore
├── .env.example                    # Environment template
└── README.md                       # Frontend docs
```

**Total Files Created**: 20+

---

## 🚀 **Quick Start**

### **1. Install Dependencies**

```bash
cd frontend
npm install
```

### **2. Start Development Server**

```bash
npm run dev
```

Frontend runs on **http://localhost:3000**

### **3. Backend Must Be Running**

Make sure the FastAPI backend is running on **http://localhost:8000**

```bash
# In root directory
docker-compose up -d
# or
poetry run uvicorn app.main:app --reload
```

---

## 🔌 **API Integration**

### **Proxy Configuration**

The Vite dev server proxies `/api/*` → `http://localhost:8000/*`:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

This avoids CORS issues during development.

### **React Query Hooks**

All API calls use React Query for:
- Automatic caching
- Background refetching
- Optimistic updates
- Loading states
- Error handling

**Example Usage**:

```typescript
// In a component
const { data: symbols, isLoading } = useSymbols()
const createSymbol = useCreateSymbol()

const handleAdd = async () => {
  await createSymbol.mutateAsync({ symbol: 'AAPL', name: 'Apple' })
}
```

---

## 🎨 **UI Design**

### **Theme**

Dark theme with green accent colors:

```typescript
// src/theme.ts
colors: {
  brand: {
    500: '#3f9142',  // Primary green
    600: '#2f8132',
  }
}
```

### **Color Coding**

- **Green**: BUY signals, profits, success states
- **Red**: SELL signals, losses, delete actions
- **Gray**: Inactive/disabled states

### **Layout**

- **Desktop**: Persistent sidebar (60px width)
- **Mobile**: Drawer menu with hamburger icon
- **Dark mode** by default

---

## 📊 **Pages Deep Dive**

### **Dashboard (`/`)**

**Purpose**: High-level overview

**Components**:
- 4 `StatsCard` components with icons
- Recent signals table (last 10)
- Open positions table
- "Run Daily Job" button

**Key Features**:
- Real-time health status (polls every 30s)
- Total P&L calculation from closed positions
- Skeleton loaders during fetch

**Code Snippet**:
```typescript
const { data: symbols } = useSymbols()
const { data: signals } = useSignals({ limit: 10 })
const triggerDaily = useTriggerDaily()

<Button onClick={() => triggerDaily.mutate()}>
  Run Daily Job
</Button>
```

---

### **Symbols (`/symbols`)**

**Purpose**: Manage trading symbols

**Features**:
- Table with symbol, name, status, date
- Add symbol modal
- Delete with confirmation (AlertDialog)
- Uppercase validation

**Workflow**:
1. Click "Add Symbol"
2. Enter symbol (auto-uppercased) and optional name
3. Submit → API call → Toast notification → Table updates

**Delete Flow**:
1. Click trash icon
2. Confirmation dialog
3. Confirm → API call → Symbol deactivated

---

### **Strategies (`/strategies`)**

**Purpose**: View and toggle strategies

**Features**:
- Card grid layout
- Enable/disable switch
- Parameter display (parsed from JSON)
- Badge status indicator

**Example Strategy Card**:
- **Header**: Strategy name + Enabled/Disabled badge
- **Key**: Strategy key in code format
- **Parameters**: Table of key-value pairs
- **Toggle**: Switch to enable/disable

---

### **Signals (`/signals`)**

**Purpose**: View and filter trading signals

**Features**:
- **Filters**: Symbol dropdown, Strategy dropdown, Limit input
- **Table**: Symbol, Action, Strategy, Confidence, Date, Price
- **Color Coding**: Green BUY badges, Red SELL badges
- **Confidence**: Progress bar + percentage
- **Metadata**: Extracted price from JSON

**Filter Behavior**:
- Changes trigger immediate refetch
- All filters optional
- Default limit: 50

---

### **Positions (`/positions`)**

**Purpose**: Manage paper trading positions

**Features**:
- **Tabs**: Open Positions / Closed Positions
- **Open Modal**: Symbol (autocomplete), Qty, Price
- **Close Modal**: Exit price input
- **P&L Calculation**: Automatic on close
- **Total P&L**: Sum of all closed positions

**Open Position Flow**:
1. Click "Open Position"
2. Enter symbol, quantity, entry price
3. Shows total value calculation
4. Submit → Creates position + execution record

**Close Position Flow**:
1. Click close icon on open position
2. Enter exit price
3. Submit → Calculates P&L → Updates table

**P&L Display**:
- Green badge for profit
- Red badge for loss
- Shows exact dollar amount

---

## 🛠️ **Development**

### **Add New Feature**

**1. Add API Type**:
```typescript
// src/types/api.ts
export interface NewFeature {
  id: number
  name: string
}
```

**2. Add API Function**:
```typescript
// src/services/api.ts
export const getNewFeature = () =>
  api.get<NewFeature[]>('/new-feature')
```

**3. Add React Query Hook**:
```typescript
// src/hooks/useApiQueries.ts
export const useNewFeature = () =>
  useQuery({
    queryKey: ['newFeature'],
    queryFn: async () => (await api.getNewFeature()).data,
  })
```

**4. Use in Component**:
```typescript
const { data, isLoading } = useNewFeature()
```

---

### **Available Scripts**

```bash
# Development
npm run dev          # Start dev server (port 3000)

# Build
npm run build        # TypeScript compile + Vite build
npm run preview      # Preview production build

# Quality
npm run lint         # ESLint check
```

---

## 🎯 **Key Technologies**

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI library |
| TypeScript | 5.3 | Type safety |
| Vite | 5.0 | Build tool (fast!) |
| Chakra UI | 2.8 | Component library |
| React Query | 5.17 | Data fetching |
| React Router | 6.21 | Navigation |
| Axios | 1.6 | HTTP client |
| date-fns | 3.2 | Date formatting |
| Framer Motion | 10.18 | Animations |

---

## 🚢 **Deployment**

### **Option 1: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel
```

**Environment Variable**:
```
VITE_API_URL=https://your-backend-api.com
```

### **Option 2: Docker**

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t stocky-frontend .
docker run -p 80:80 stocky-frontend
```

### **Option 3: Static Hosting**

1. Build: `npm run build`
2. Upload `dist/` folder to:
   - Netlify
   - GitHub Pages
   - AWS S3 + CloudFront
   - Any static host

---

## 🔧 **Configuration**

### **Environment Variables**

Create `.env`:

```bash
# Optional: Override API URL
VITE_API_URL=http://localhost:8000

# Or use proxy (default behavior)
```

### **Customize Theme**

Edit `src/theme.ts`:

```typescript
const theme = extendTheme({
  colors: {
    brand: {
      500: '#your-color',  // Change primary color
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',      // Background color
      },
    },
  },
})
```

---

## 🐛 **Troubleshooting**

### **CORS Errors**

**Problem**: API calls blocked by CORS

**Solution**:
1. Check backend has CORS enabled for `http://localhost:3000`
2. Use Vite proxy (default in `vite.config.ts`)

### **API Not Found (404)**

**Problem**: `/api/symbols` returns 404

**Solution**:
1. Backend must be running on port 8000
2. Check proxy config in `vite.config.ts`
3. Verify backend endpoints work directly

### **Build Errors**

**Problem**: TypeScript errors during build

**Solution**:
```bash
# Clear cache
rm -rf node_modules/.vite
rm -rf node_modules

# Reinstall
npm install
```

### **Hot Reload Not Working**

**Problem**: Changes not reflected

**Solution**:
```bash
# Restart dev server
npm run dev
```

---

## 📈 **Performance**

### **Optimizations Implemented**

✅ **React Query Caching**
- 30s stale time
- Background refetching
- Automatic cache invalidation

✅ **Code Splitting**
- Route-based splitting
- Lazy loading components

✅ **Vite Build**
- Fast HMR (Hot Module Replacement)
- Optimized production builds
- Tree shaking

✅ **Chakra UI**
- Only imports used components
- CSS-in-JS with zero runtime

---

## 🎓 **Learning Resources**

- **React**: https://react.dev
- **Chakra UI**: https://chakra-ui.com
- **React Query**: https://tanstack.com/query
- **Vite**: https://vitejs.dev
- **TypeScript**: https://www.typescriptlang.org

---

## ✅ **Testing Checklist**

### **Manual Testing**

- [ ] Dashboard loads with correct stats
- [ ] Add symbol works
- [ ] Delete symbol shows confirmation
- [ ] Strategies toggle works
- [ ] Signals filter works
- [ ] Open position calculates total value
- [ ] Close position calculates P&L correctly
- [ ] Run daily job shows toast notification
- [ ] Navigation between pages works
- [ ] Mobile responsive (check drawer menu)

### **Integration Testing**

```bash
# Start backend
docker-compose up -d

# Start frontend
cd frontend && npm run dev

# Test full workflow
1. Add symbol (AAPL)
2. Run daily job
3. View signals
4. Open position
5. Close position
6. Check P&L
```

---

## 🎉 **Summary**

**Complete React frontend with**:
- 5 pages fully implemented
- Real-time data fetching
- Toast notifications
- Loading states
- Error handling
- Dark theme
- Mobile responsive
- Type-safe API integration
- Production-ready code

**Ready to use!** 🚀

---

**Next Steps**: See [README.md](README.md) for full project documentation.
