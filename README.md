# UAE Property Portal

A mobile-first React web application for UAE real estate agents to search, select, and inquire about properties. The portal connects to Supabase for property data and submits inquiries via webhook integration.

## Features

- **Advanced Property Search**: Filter by unit type, transaction type, bedrooms, price range, area, community, and more
- **Multi-Selection**: Select multiple properties for batch inquiries
- **Persistent Form Data**: Agent details are saved across inquiry sessions
- **Mobile-First Design**: Optimized for mobile devices with responsive desktop support
- **Real-time Data**: Direct integration with Supabase property database
- **Webhook Integration**: Sends inquiry data to external systems

## Setup Instructions

### 1. Prerequisites

- Node.js 18 or higher
- A Supabase project with property data
- A webhook endpoint to receive inquiries

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_supabase_database_connection_string

# Webhook Configuration
VITE_WEBHOOK_URL=your_webhook_endpoint_url
```

### 3. Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/projects)
2. Select your project or create a new one
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → Use as `VITE_SUPABASE_URL`
   - **anon public key** → Use as `VITE_SUPABASE_ANON_KEY`
5. For `DATABASE_URL`:
   - Click **Connect** button in the top toolbar
   - Copy the URI under "Connection string" → "Transaction pooler"
   - Replace `[YOUR-PASSWORD]` with your database password

### 4. Installation and Running

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5000`

## Database Schema

The application expects a `properties` table in Supabase with the following structure:

```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  unit_kind TEXT NOT NULL, -- apartment, villa, townhouse, penthouse
  transaction_type TEXT NOT NULL, -- sale, rent
  property_type TEXT, -- residential, commercial
  beds TEXT, -- studio, 1, 2, 3, 4, 5+
  baths INTEGER,
  area_sqft INTEGER,
  price DECIMAL(12,2) NOT NULL,
  community TEXT,
  location TEXT,
  description TEXT,
  off_plan BOOLEAN DEFAULT false,
  distressed BOOLEAN DEFAULT false,
  property_id TEXT UNIQUE,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage

### For Real Estate Agents

1. **Search Properties**: Use the filter panel to set search criteria
2. **Select Properties**: Check boxes on property cards to select multiple units
3. **Submit Inquiry**: Click the floating action button to open the inquiry form
4. **Fill Details**: Enter WhatsApp number and optional notes/portal links
5. **Send**: Submit the inquiry - data is sent to the configured webhook

### Demo Mode

When Supabase credentials are not configured, the application runs in demo mode with sample property data. This allows you to test all features before connecting to your actual database.

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
2. Your Supabase project has the required `properties` table
3. The webhook URL is accessible and accepts POST requests
4. Your Supabase database permissions allow reading from the `properties` table

## Security Notes

- The `VITE_SUPABASE_ANON_KEY` is safe to expose in client-side code
- Ensure your Supabase Row Level Security (RLS) policies are properly configured
- The webhook endpoint should validate incoming requests
- Consider implementing rate limiting on your webhook endpoint