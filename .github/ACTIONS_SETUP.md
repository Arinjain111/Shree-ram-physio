# GitHub Actions Setup Guide

## 📋 Prerequisites

1. Azure App Service created and running
2. GitHub repository with your code
3. Access to Azure Portal and GitHub Settings

---

## 🔐 Step 1: Get Azure Publish Profile

### Option A: Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your App Service: `shri-ram-physio-api`
3. Click **Get publish profile** (top toolbar)
4. Download the `.PublishSettings` file
5. Open it in a text editor and copy **entire XML content**

### Option B: Azure CLI
```powershell
az webapp deployment list-publishing-profiles `
  --name shri-ram-physio-api `
  --resource-group shri-ram-physio-rg `
  --xml
```

---

## 🔑 Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

### Secret 1: AZURE_WEBAPP_PUBLISH_PROFILE
- **Name**: `AZURE_WEBAPP_PUBLISH_PROFILE`
- **Value**: Paste the entire XML content from publish profile
- Click **Add secret**

### Secret 2: DATABASE_URL
- **Name**: `DATABASE_URL`
- **Value**: Your Prisma connection string
  ```
  sqlserver://your-server.database.windows.net:1433;database=your-db;user=your-user;password=your-password;encrypt=true;trustServerCertificate=false
  ```
- Click **Add secret**

---

## ⚙️ Step 3: Configure Workflow Settings

### Update Workflow File (if needed)

Edit `.github/workflows/backend-deploy.yml`:

```yaml
env:
  AZURE_WEBAPP_NAME: shri-ram-physio-api  # ← Change to your App Service name
  NODE_VERSION: '18.x'
```

---

## 🚀 Step 4: Test Deployment

### Automatic Trigger
```powershell
# Make a change to Backend code
cd Backend
echo "# Test" >> README.md

# Commit and push
git add .
git commit -m "Test GitHub Actions deployment"
git push origin main
```

### Manual Trigger
1. Go to GitHub → **Actions** tab
2. Select **Deploy Backend to Azure**
3. Click **Run workflow** → **Run workflow**

---

## 📊 Step 5: Monitor Deployment

### Watch GitHub Actions
1. Go to **Actions** tab in GitHub
2. Click on the running workflow
3. Watch real-time logs for each step:
   - ✅ Checkout code
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Generate Prisma Client
   - ✅ Build TypeScript
   - ✅ Deploy to Azure
   - ✅ Run Prisma migrations

### Check Azure
1. Go to Azure Portal → App Service
2. Check **Deployment Center** → **Logs**
3. Verify deployment status

---

## ✅ Verify Deployment

### Test Endpoints
```powershell
# Health check
curl https://shri-ram-physio-api.azurewebsites.net/health

# Get patients
curl https://shri-ram-physio-api.azurewebsites.net/api/patients

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-12-05T..."
}
```

---

## 🔧 Troubleshooting

### Deployment Fails

**Issue**: "Failed to deploy to Azure"
- **Solution**: Check publish profile is correct and not expired
- **Action**: Re-download publish profile from Azure Portal

**Issue**: "Prisma migration failed"
- **Solution**: Verify DATABASE_URL secret is correct
- **Action**: Test connection string locally first

**Issue**: "Build fails with TypeScript errors"
- **Solution**: Run CI workflow first (checks PRs before deployment)
- **Action**: Fix errors locally, then push

### View Azure Logs
```powershell
# Stream logs
az webapp log tail --name shri-ram-physio-api --resource-group shri-ram-physio-rg

# Download logs
az webapp log download --name shri-ram-physio-api --resource-group shri-ram-physio-rg --log-file logs.zip
```

---

## 🔄 CI/CD Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Developer pushes to main (Backend changes)             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions: backend-deploy.yml                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 1. Checkout code                                 │   │
│  │ 2. Setup Node.js 18.x                            │   │
│  │ 3. npm ci (install dependencies)                 │   │
│  │ 4. npx prisma generate (create Prisma Client)    │   │
│  │ 5. npm run build (compile TypeScript)            │   │
│  │ 6. Create deployment ZIP                         │   │
│  │ 7. Deploy to Azure App Service                   │   │
│  │ 8. npx prisma migrate deploy (run migrations)    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  Azure App Service: shri-ram-physio-api                 │
│  - Receives deployment package                          │
│  - Restarts app                                         │
│  - Applies database migrations                          │
│  - ✅ Deployment complete!                               │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Best Practices

### Branch Protection
1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require pull request reviews
   - ✅ Require status checks (CI workflow)
   - ✅ Require branches to be up to date

### Environment-Specific Deployments

Create separate workflows for staging/production:

```yaml
# .github/workflows/backend-deploy-staging.yml
env:
  AZURE_WEBAPP_NAME: shri-ram-physio-api-staging

# .github/workflows/backend-deploy-production.yml
env:
  AZURE_WEBAPP_NAME: shri-ram-physio-api-production
```

### Rollback Strategy
If deployment fails:

```powershell
# Via Azure Portal
1. Go to Deployment Center → Deployment History
2. Click on previous successful deployment
3. Click "Redeploy"

# Via Git
git revert HEAD
git push origin main  # Triggers new deployment with reverted code
```

---

## 🎯 Next Steps

1. ✅ Add GitHub secrets
2. ✅ Push code to trigger first deployment
3. ✅ Monitor deployment in Actions tab
4. ✅ Verify endpoints work
5. ✅ Set up branch protection rules
6. ✅ Create staging environment (optional)

---

**Your backend now deploys automatically on every push to main! 🚀**
