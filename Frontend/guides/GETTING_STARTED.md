# 🚀 Getting Started with Shri Ram Physio Invoicing App

Welcome! This guide will help you get your physiotherapy clinic's offline-first invoicing system up and running in minutes.

---

## 📋 Prerequisites

Before you begin, make sure you have:
- ✅ Windows 10 or later (or macOS/Linux)
- ✅ Internet connection (for initial setup and cloud sync)
- ✅ A printer configured (for printing invoices)
- ✅ Backend server running (for sync functionality)

---

## 🏗️ Architecture Overview

This is an **offline-first** Electron desktop app:
- 💾 **Local Storage**: SQLite database with Prisma ORM
- ☁️ **Cloud Sync**: Automatic bidirectional sync with Azure SQL
- 🔄 **Multi-Device**: Work on multiple computers with data sync
- 📱 **Offline-Capable**: Create invoices without internet

---

## ⚡ Quick Setup (10 Minutes)

### Step 1: Install Node.js

1. Download Node.js (v18 or higher) from: https://nodejs.org/
2. Run the installer
3. Accept all defaults and complete installation
4. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

### Step 2: Setup the Application

1. Open PowerShell in the Frontend folder:
   - Right-click in the folder while holding Shift
   - Select "Open PowerShell window here"

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Generate Prisma Client:
   ```powershell
   npm run prisma:generate
   ```

4. Create database schema:
   ```powershell
   npm run prisma:migrate
   ```
   When prompted for migration name, enter: `init`

5. Configure Backend URL:
   
   Edit `.env` file:
   ```env
   # For local testing
   AZURE_BACKEND_URL=http://localhost:3000
   
   # For production
   # AZURE_BACKEND_URL=https://your-backend.azurewebsites.net
   ```

6. Build Electron main process:
   ```powershell
   npm run build:electron
   ```

### Step 3: Start the Application

```powershell
npm run dev
```

This will:
- Start Vite dev server
- Open Electron window
- Initialize SQLite database
- Enable DevTools for debugging

That's it! The application is now running with offline-first capabilities.

---

## 🎯 First Time Configuration

### 1. Customize Your Invoice (Recommended First Step)

1. Click **"Invoice Customizer"** on the home screen
2. Fill in your clinic details:
   - Clinic Name: "Shri Ram Physiotherapy Clinic"
   - Address: Your clinic address
   - Phone: Your contact number
   - Email: Your clinic email
   - Doctor Name: Your name
   - Registration Number: Your professional registration number

3. Upload your clinic logo:
   - Click "Upload Logo"
   - Select your logo image (PNG or JPG)
   - Preview appears on the right

4. Adjust layout preferences:
   - Header Alignment: Center (recommended)
   - Logo Position: Center
   - Font Size: Medium
   - Show Border: Yes (recommended)

5. Click **"Save Layout"**

✅ Your invoice template is now ready!

---

## 📄 Creating Your First Invoice

### Step 1: Open Invoice Generator

1. Return to home page (click "← Back")
2. Click **"Invoice Generator"**

### Step 2: Fill Patient Information

1. **Patient Name**: Enter full name
2. **Age**: Enter age in years
3. **Gender**: Select from dropdown
4. **Phone Number**: Enter contact number (optional)
5. **Address**: Enter patient address (optional)

### Step 3: Add Treatment Details

1. The first treatment item is already there
2. Fill in:
   - **Treatment/Service**: e.g., "Physiotherapy Session"
   - **Quantity**: Usually 1
   - **Rate**: Amount in Rupees (e.g., 500)
   - **Amount**: Automatically calculated

3. To add more treatments:
   - Click **"+ Add Item"**
   - Fill in the new treatment details
   - Total updates automatically

### Step 4: Add Additional Information

1. **Date**: Today's date is pre-filled (change if needed)
2. **Payment Method**: Select Cash/Card/UPI/Other
3. **Notes/Prescription**: Add any treatment notes or exercises

### Step 5: Print

1. Click **"Preview"** to see the invoice
2. Click **"Print"** to send to printer
3. Or click **"Save & Print"** directly from the form

✅ Your invoice is saved and ready to print!

---

## 🔍 Finding Patient Records

### Searching for Patients

1. Click **"Database Find"** on home page
2. Use the search bar to find patients:
   - Type patient name, or
   - Type age, or
   - Type phone number, or
   - Type invoice ID

3. Click **"Search"** or press Enter

### Viewing Patient History

1. Click on any patient card
2. View complete details:
   - Patient information
   - All past invoices
   - Treatment history
   - Total visits

---

## 💡 Tips for Daily Use

### Quick Workflow

1. **Morning**: Open the app (`npm start`)
2. **For Each Patient**:
   - Invoice Generator → Fill details → Print
3. **To Check History**: Database Find → Search patient
4. **End of Day**: You can close the app (data is saved automatically)

### Best Practices

✅ **Do's:**
- Always fill patient name and age (required)
- Add phone numbers for better tracking
- Use consistent treatment names
- Add prescription notes for record keeping
- Print immediately after creating invoice

❌ **Don'ts:**
- Don't close app during printing
- Don't use special characters in patient names
- Don't skip saving before closing

### Common Tasks

**Add New Treatment Type:**
- Just type it in the Treatment/Service field
- It will be saved and remembered

**Reprint Old Invoice:**
- Go to Database Find
- Find the patient
- View invoice details
- (Note: Reprint feature coming in next version)

**Update Clinic Information:**
- Go to Invoice Customizer
- Update any field
- Click Save Layout

**Change Logo:**
- Go to Invoice Customizer
- Upload new logo
- Click Save Layout

---

## 🛠️ Daily Operations

### Starting Your Day

```powershell
# Open PowerShell in the app folder
npm start
```

### If Application Doesn't Start

```powershell
# Rebuild and start
npm run build
npm start
```

### Closing the Application

- Click the X button on the window
- Or use Alt+F4
- Data is automatically saved

---

## 📊 Understanding Your Data

### Where Is Data Stored?

All your data is saved on your computer at:
```
C:\Users\[YourUsername]\AppData\Roaming\shri-ram-physio-invoicing\
```

This includes:
- `invoices/` - All invoice data
- `config/` - Your customization settings

### Backing Up Your Data

**Recommended: Weekly backups**

1. Close the application
2. Copy the entire folder mentioned above
3. Save to USB drive or cloud storage (Dropbox, Google Drive, etc.)

---

## 🎨 Customization Examples

### Professional Look
- Header Alignment: Center
- Logo: Center
- Font Size: Medium
- Border: Yes

### Minimalist Style
- Header Alignment: Left
- Logo: Left
- Font Size: Small
- Border: No

### Large Print (For Older Patients)
- Header Alignment: Center
- Logo: Center
- Font Size: Large
- Border: Yes

---

## 🔧 Troubleshooting

### "npm is not recognized"
**Solution**: Node.js not installed properly
- Reinstall Node.js from https://nodejs.org/
- Restart computer
- Try again

### "Cannot find module"
**Solution**: Dependencies not installed
```powershell
npm install
npm run build
npm start
```

### Print Doesn't Work
**Solution**: Check printer
- Ensure printer is connected
- Set as default printer in Windows
- Try printing a test page from Windows first

### Application Runs Slow
**Solution**: Too many invoices
- This is normal after 5000+ invoices
- Create a backup
- (Archive feature coming in next version)

### Lost Customization
**Solution**: Settings not saved
- Go to Invoice Customizer
- Re-enter your information
- Click "Save Layout" (important!)

---

## 📞 Getting Help

### Before Asking for Help

1. Check this guide
2. Check README.md
3. Check INVOICE_TEMPLATE_REFERENCE.md
4. Try restarting the application

### Quick Reference Commands

```powershell
# Start application
npm start

# Rebuild application
npm run build

# Install dependencies
npm install

# Watch for changes (development)
npm run watch
```

---

## 🎓 Learning Resources

### Included Documentation
1. **README.md** - Technical documentation
2. **QUICK_START.md** - Fast setup guide
3. **INVOICE_TEMPLATE_REFERENCE.md** - Layout examples
4. **SAMPLE_DATA.md** - Test data and examples
5. **FEATURES_ROADMAP.md** - Upcoming features

### Practice Data
Use the sample data in `SAMPLE_DATA.md` to practice creating invoices before using with real patients.

---

## ✅ Post-Setup Checklist

After setup, verify:
- [ ] Application opens without errors
- [ ] You can navigate between all three sections
- [ ] Clinic information is saved in Invoice Customizer
- [ ] You can create a test invoice
- [ ] Print preview works
- [ ] You can search in Database Find
- [ ] Your logo appears correctly (if uploaded)

---

## 🚀 You're Ready!

You've successfully set up your clinic's invoicing system. Start creating invoices and managing patient records right away!

**Next Steps:**
1. Customize your invoice with clinic details
2. Create a few test invoices
3. Practice searching patient records
4. Start using with real patients

---

## 💬 Feedback

This is version 1.0. Your feedback helps improve the application!

**Loving a feature?** Let us know!
**Found an issue?** Report it!
**Need a new feature?** Suggest it!

---

**Happy Invoicing! 🎉**

*Shri Ram Physiotherapy Clinic - Invoice Management Made Simple*
