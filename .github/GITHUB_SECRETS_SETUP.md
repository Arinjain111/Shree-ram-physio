# GitHub Secrets Setup for Backend Deployment

## Required Secrets

You need to add the following secrets to your GitHub repository for the backend deployment to work correctly.

### How to Add Secrets

1. Go to your GitHub repository: https://github.com/Arinjain111/Shree-ram-physio
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret below

---

## Secrets to Add

### 1. DATABASE_URL ⚠️ **CRITICAL - Currently Missing**

**Name:** `DATABASE_URL`

**Value:** (Use your Azure SQL connection string)
```
sqlserver://shree-ram-physio-server.database.windows.net:1433;database=shree-ram-physio-db;user=adminUser;password=Ajay-hot@36;encrypt=true;trustServerCertificate=false
```

> ⚠️ **This is WHY you're getting "Login failed for user 'sa'" error!**
> The workflow is using `${{ secrets.DATABASE_URL }}` but since the secret doesn't exist, it falls back to the default `sa` user.

---

### 2. Azure Authentication (OIDC)

#### AZURE_CLIENT_ID
**Name:** `AZURE_CLIENT_ID`  
**Value:** Your Azure Service Principal Client ID

#### AZURE_TENANT_ID
**Name:** `AZURE_TENANT_ID`  
**Value:** Your Azure Tenant ID

#### AZURE_SUBSCRIPTION_ID
**Name:** `AZURE_SUBSCRIPTION_ID`  
**Value:** Your Azure Subscription ID

---

### 3. Docker Hub Credentials

#### DOCKERHUB_USERNAME
**Name:** `DOCKERHUB_USERNAME`  
**Value:** Your Docker Hub username

#### DOCKERHUB_TOKEN
**Name:** `DOCKERHUB_TOKEN`  
**Value:** Your Docker Hub access token (not password!)

To create a Docker Hub access token:
1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name it "github-actions"
4. Copy the token immediately (you won't see it again)

---

## Quick Fix for DATABASE_URL

### Option 1: Add GitHub Secret (Recommended)

Follow the steps above to add `DATABASE_URL` as a secret.

### Option 2: Update Azure App Service Directly (Temporary)

Run this PowerShell script to update Azure App Service config:

```powershell
cd Backend
.\update-azure-config.ps1
```

This will set the correct DATABASE_URL in Azure App Service without needing to redeploy.

---

## Verify Secrets

After adding secrets, you can verify them:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see all secrets listed (values are hidden)
3. Try pushing a change to trigger the workflow

---

## Current Workflow Status

✅ **DATABASE_URL** - Now properly quoted in workflow  
✅ **ALLOWED_ORIGINS** - Added to workflow (set to `*` for now)  
⚠️ **Secrets** - Need to be added in GitHub

---

## After Adding Secrets

1. Push the updated workflow file:
   ```bash
   git add .github/workflows/backend-deploy.yml
   git commit -m "Fix: Add ALLOWED_ORIGINS and quote DATABASE_URL"
   git push
   ```

2. Or manually trigger the workflow:
   - Go to **Actions** tab
   - Select "Deploy Backend to Azure"
   - Click "Run workflow"

3. The deployment should now succeed with the correct Azure SQL credentials!
