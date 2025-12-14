# Quick Start Guide - Shri Ram Physio Invoicing App

## First Time Setup

1. **Install Dependencies**
   ```powershell
   npm install
   ```
   ✅ This has already been completed!

2. **Setup Database & Prisma**
   ```powershell
   # Generate Prisma Client
   npm run prisma:generate
   
   # Create database schema (SQLite)
   npm run prisma:migrate
   ```

3. **Configure Backend URL**
   
   Edit `.env` file:
   ```env
   AZURE_BACKEND_URL=http://localhost:3000
   ```
   
   (For local testing with Backend running on port 3000)

4. **Build Electron Main Process**
   ```powershell
   npm run build:electron
   ```

5. **Start Development Server**
   ```powershell
   npm run dev
   ```
   This will:
   - Start Vite dev server on http://localhost:5173
   - Launch Electron window automatically
   - Enable hot module replacement (HMR)
   - Initialize SQLite database with Prisma

## Development Workflow

### Running the App
```powershell
npm run dev
```
- Any changes to React components will update instantly (HMR)
- Electron main process changes require restart

### Building for Production
```powershell
# Build React app
npm run build

# Package Electron app (creates installer)
npm run build:electron
```

## What's Different from Before

### Before (Vanilla HTML/CSS)
- Manual page refreshes after every change
- Plain HTML files with inline styles
- No component reusability

### Now (React + Vite + Tailwind)
- **Hot Module Replacement**: Changes appear instantly without refresh
- **React Components**: Reusable UI components
- **Tailwind CSS v4**: Utility-first styling with fast builds
- **TypeScript**: Type-safe development
- **Better Dev Experience**: Faster iteration and development

## Key Features

### Invoice Generator
- Create invoices with patient details
- Add multiple treatment items
- Auto-calculate totals
- Print using Windows print dialog

### Database Find
- Search patients by name/phone
- View patient history
- See all past invoices
- Grouped patient cards

### Invoice Customizer
- Customize clinic information
- Upload clinic logo
- Configure layout (alignment, fonts, borders)
- Live preview

## Keyboard Shortcuts (in Development)

- `Ctrl + R`: Reload window (if HMR fails)
- `Ctrl + Shift + I`: Open DevTools (for debugging)
- `Ctrl + C` (in terminal): Stop dev server

## Troubleshooting

### Port 5173 Already in Use
```powershell
# Find and kill process using port 5173
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process
```

### TypeScript Errors Not Clearing
```powershell
# Restart TypeScript server in VS Code
# Press F1 → Type "TypeScript: Restart TS Server"
```

### Vite Not Building
```powershell
# Clear cache and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force dist-electron
npm install
```

## Testing Checklist

- [ ] Start dev server: `npm run dev`
- [ ] Test hot reload (edit a component, see instant update)
- [ ] Create an invoice and print
- [ ] Search for saved invoices
- [ ] Customize clinic layout
- [ ] Upload a logo
- [ ] Verify all data saves correctly

## Next Steps

1. Run `npm run dev` to start the application
2. Test all three features (Invoice Generator, Database Find, Customizer)
3. Make customizations as needed
4. Build production version when ready

## Support

All data is stored locally in JSON files:
- `invoices.json` - All patient invoices
- `layout.json` - Clinic branding and layout settings

---

**Ready to start?** Run `npm run dev` in your terminal! 🚀
