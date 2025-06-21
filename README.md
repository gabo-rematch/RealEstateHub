# UAE Property Portal

A mobile-first React web application for UAE real estate agents to search, select, and inquire about properties. The portal connects to Supabase for property data and submits inquiries via webhook integration.

## Features

- **Advanced Property Search**: Filter by unit type, transaction type, bedrooms, price range, area, community, and more
- **Multi-Selection**: Select multiple properties for batch inquiries
- **Persistent Form Data**: Agent details are saved across inquiry sessions
- **Mobile-First Design**: Optimized for mobile devices with responsive desktop support
- **Real-time Data**: Direct integration with Supabase property database
- **Webhook Integration**: Sends inquiry data to external systems

## Prerequisites

**Important**: This application requires a properly configured Supabase database with property data to function. The app will not start without valid Supabase credentials and will not display any properties without data in the database.

### Required Setup

- Node.js 18 or higher
- A Supabase project with property data in the `inventory_unit_preference` table
- A webhook endpoint to receive inquiries

## Setup Instructions

### 1. Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd RealEstateHub
npm install

# 2. Set up environment variables
npm run setup
# Edit .env with your Supabase credentials

# 3. Validate setup
npm run check-env

# 4. Start development server
npm run dev
```

> 📖 **Need detailed setup instructions?** See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for a complete step-by-step walkthrough.

### 2. Environment Variables

Edit the generated `.env` file with your actual values:

```env
# ==============================================
# SUPABASE CONFIGURATION (Required)
# ==============================================
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# ==============================================
# WEBHOOK CONFIGURATION (Required)
# ==============================================
VITE_WEBHOOK_URL=https://your-webhook-endpoint.com/inquiries

# ==============================================
# APPLICATION CONFIGURATION (Optional)
# ==============================================
PORT=5000
NODE_ENV=development
```

**Important:** 
- The `.env` file is ignored by git for security. Never commit it to version control.
- The application will not start without valid Supabase credentials.
- The webhook URL is required for inquiry submissions to work.

### 3. Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Select your project or create a new one
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → Use as `SUPABASE_URL`
   - **anon public key** → Use as `SUPABASE_ANON_KEY`

### 4. Database Setup

The application requires the following table structure in your Supabase database:

```sql
-- Main table for property preferences/listings
CREATE TABLE inventory_unit_preference (
  pk SERIAL PRIMARY KEY,
  id VARCHAR,
  data JSONB, -- Contains all property details as flexible JSON
  updated_at TIMESTAMP DEFAULT NOW(),
  inventory_unit_pk INTEGER
);

-- Related table for agent contact details
CREATE TABLE inventory_unit (
  pk SERIAL PRIMARY KEY,
  agent_details JSONB -- Contains agent contact information
);
```

**Note**: The application will not function without data in the `inventory_unit_preference` table.

### 5. Running the Application

After configuring your `.env` file:

```bash
# Development mode
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run check

# Full CI pipeline (check + build)
npm run ci
```

The application will be available at `http://localhost:5000` (or the PORT you specified)

## Database Schema

The `data` JSONB field contains property information such as:
- `kind` (listing, client_request)
- `transaction_type` (sale, rent)
- `bedrooms`, `bathrooms` (arrays or single values)
- `property_type` (apartment, villa, townhouse, etc.)
- `communities` (location information)
- `price_aed`, `budget_min_aed`, `budget_max_aed`
- `area_sqft`, `message_body_raw`, and other property details

## Usage

### For Real Estate Agents

1. **Search Properties**: Use the filter panel to set search criteria
2. **Select Properties**: Check boxes on property cards to select multiple units
3. **Submit Inquiry**: Click the floating action button to open the inquiry form
4. **Fill Details**: Enter WhatsApp number and optional notes/portal links
5. **Send**: Submit the inquiry - data is sent to the configured webhook

## Webhook Payload

When an inquiry is submitted, the following JSON payload is sent to your webhook URL:

```json
{
  "selectedUnitIds": ["1", "2", "3"],
  "formData": {
    "whatsappNumber": "+971501234567",
    "notes": "Looking for immediate availability",
    "portalLink": "https://example.com/portal",
    "searchCriteria": {
      "unit_kind": "apartment",
      "transaction_type": "rent",
      "beds": "2",
      "community": "downtown"
    }
  },
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

## Technical Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Data Fetching**: TanStack Query
- **Database**: Supabase (PostgreSQL)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

## Development

The application follows a mobile-first approach with:

- Responsive design that works on all screen sizes
- Touch-friendly interactions and gestures
- Optimized loading states and error handling
- Accessibility features and keyboard navigation
- Session persistence for form data

## Support

For issues with setup or configuration, ensure that:

1. All environment variables are correctly set
2. Your Supabase project has the required `inventory_unit_preference` table with data
3. The webhook URL is accessible and accepts POST requests
4. Your Supabase database permissions allow reading from the `inventory_unit_preference` table

## Security Notes

- The `VITE_SUPABASE_ANON_KEY` is safe to expose in client-side code
- Ensure your Supabase Row Level Security (RLS) policies are properly configured
- The webhook endpoint should validate incoming requests
- Consider implementing rate limiting on your webhook endpoint