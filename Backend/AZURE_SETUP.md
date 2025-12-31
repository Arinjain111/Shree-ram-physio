# Azure App Service Configuration

To enable Prisma Accelerate and Supabase, you need to update the Environment Variables in your Azure App Service.

1. Go to your **Azure Portal**.
2. Navigate to your **App Service** (Backend).
3. In the left menu, select **Settings** -> **Environment Variables** (or Configuration -> Application Settings).
4. Add or Update the following settings:

| Name | Value | Description |
|------|-------|-------------|
| `DATABASE_URL` | `prisma://accelerate.prisma-data.net/...` | Your Prisma Accelerate Connection String |

> [!IMPORTANT]
> Make sure to remove any old MSSQL specific variables if they are no longer needed, though keeping them won't hurt if not used.

5. Click **Apply** and then **Restart** your App Service.
