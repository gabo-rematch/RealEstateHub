# UAE Property Portal - Complete Setup Guide

This guide provides detailed step-by-step instructions for setting up the UAE Property Portal application. **Important**: This application requires a properly configured Supabase database with property data to function.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18 or higher** installed on your system
- A **Supabase account** and project with property data
- A **webhook endpoint** to receive inquiry submissions
- Basic familiarity with command line tools

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd RealEstateHub

# Install dependencies
npm install
```

### 2. Create Environment Configuration

```bash
# Generate .env file from template
npm run setup
```

This creates a `.env` file with template values that you'll need to replace with your actual configuration.

### 3. Configure Supabase

#### 3.1 Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Select your project (or create a new one)
3. Navigate to **Settings** → **API**
4. Copy the following values:
   - **Project URL** (e.g., `https://your-project-id.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

#### 3.2 Update Environment Variables

Edit the `.env` file and replace the template values:

```env
# Replace these with your actual Supabase credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key_here

# Replace with your webhook endpoint
VITE_WEBHOOK_URL=https://your-webhook-endpoint.com/inquiries
```

### 4. Set Up Database Schema

The application requires specific tables in your Supabase database. Run these SQL commands in your Supabase SQL Editor:

```sql
-- Main table for property preferences/listings
CREATE TABLE IF NOT EXISTS inventory_unit_preference (
  pk SERIAL PRIMARY KEY,
  id VARCHAR,
  data JSONB, -- Contains all property details as flexible JSON
  updated_at TIMESTAMP DEFAULT NOW(),
  inventory_unit_pk INTEGER
);

-- Related table for agent contact details  
CREATE TABLE IF NOT EXISTS inventory_unit (
  pk SERIAL PRIMARY KEY,
  agent_details JSONB -- Contains agent contact information
);
```

**Important**: The application will not function without data in the `inventory_unit_preference` table.

### 5. Configure Database Permissions

Ensure your Supabase Row Level Security (RLS) policies allow reading from the `inventory_unit_preference` table:

```sql
-- Enable RLS
ALTER TABLE inventory_unit_preference ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous reads (adjust as needed for your security requirements)
CREATE POLICY "Allow anonymous read access" ON inventory_unit_preference
  FOR SELECT USING (true);
```

### 6. Add Property Data

You need to populate the `inventory_unit_preference` table with property data. Each record should have a `data` JSONB field containing property information:

```json
{
  "kind": "listing",
  "transaction_type": "rent",
  "bedrooms": ["2"],
  "property_type": ["apartment"],
  "communities": ["Downtown Dubai"],
  "price_aed": 120000,
  "area_sqft": 1200,
  "message_body_raw": "Beautiful 2-bedroom apartment in Downtown Dubai",
  "furnishing": "furnished",
  "is_urgent": false,
  "is_agent_covered": true,
  "bathrooms": ["2"],
  "location_raw": "Downtown Dubai, Dubai",
  "other_details": "Balcony, Gym, Pool",
  "has_maid_bedroom": false,
  "is_direct": true,
  "mortgage_or_cash": "cash",
  "is_distressed_deal": false,
  "is_off_plan": false,
  "is_mortgage_approved": false,
  "is_community_agnostic": false,
  "developers": ["Emaar"],
  "whatsapp_participant": "+971501234567",
  "agent_phone": "+971501234567",
  "groupJID": "group_id_here",
  "evolution_instance_id": "instance_id_here"
}
```

### 7. Configure Webhook Endpoint

Set up an endpoint to receive inquiry submissions. The webhook should:

- Accept POST requests
- Handle JSON payloads
- Return appropriate HTTP status codes
- Be accessible via HTTPS

Example webhook URL: `https://your-domain.com/api/inquiries`

### 8. Validate Configuration

Run the environment validation script:

```bash
npm run check-env
```

This will verify that all required environment variables are properly configured.

### 9. Start the Application

```bash
# Start in development mode
npm run dev
```

The application will be available at `http://localhost:5000`

## Verification Checklist

✅ **Environment Variables**
- Run `npm run check-env` - all checks should pass
- No template values (like `your_project_id`) remain in `.env`

✅ **Database Connection**
- Application starts without database connection errors
- API endpoint `/api/test-db` returns success

✅ **Database Data**
- Property search returns results from your database
- Filter options are populated from actual data

✅ **Basic Functionality**
- Inquiry modal opens and accepts form data
- No console errors in browser developer tools

## Common Issues & Solutions

### Issue: "Supabase connection not configured"
**Solution:** Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the `.env` file.

### Issue: Environment validation fails
**Solution:** Run `npm run check-env` to see specific issues and fix them.

### Issue: Database connection errors
**Solution:** Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct and your Supabase project is active.

### Issue: No properties displayed
**Solution:** Ensure your `inventory_unit_preference` table contains data. The application requires actual property data to function.

### Issue: Filter options are empty
**Solution:** The filter options are extracted from your actual property data. Add more diverse property data to populate the filters.

### Issue: Webhook submissions not working
**Solution:** Ensure `VITE_WEBHOOK_URL` points to a valid HTTPS endpoint that accepts POST requests.

### Issue: Port already in use
**Solution:** Change the `PORT` in your `.env` file or stop other applications using port 5000.

## Next Steps

After successful setup:

1. **Import Property Data:** Use your Supabase dashboard to import property data
2. **Configure Webhook:** Set up an endpoint to receive inquiry submissions
3. **Customize Filters:** Modify search filters based on your property data structure
4. **Test Functionality:** Verify that property search, selection, and inquiry submission work correctly

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in your environment variables
2. Use a production webhook endpoint
3. Configure proper CORS settings if needed
4. Set up monitoring and logging
5. Consider using a CDN for static assets
6. Implement proper error handling and monitoring

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify all environment variables are correctly set
3. Ensure your Supabase database contains property data
4. Test your webhook endpoint independently
5. Review the application logs for server-side errors 