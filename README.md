# GenieDevs — React Storefront Platform

GenieDevs is a modern digital storefront builder designed for local brands, boutiques, homemade food businesses, and independent retailers. It provides quick product catalog setup, flexible fractional unit support (pieces, kg, grams, litres, ml, etc.), order tracking, and WhatsApp-first order placement.

## Features

- **Responsive Landing Page**: Polished hero with interactive 3D concept card, features, transparent package pricing (Basic, Standard, Premium), and support inquiry form.
- **Interactive Live Demo (`/demo`)**: Complete mock seller workspace with Overview KPIs, Catalog management, Sample orders workflow, Store settings with slug preview, Customer storefront view, and WhatsApp order preview.
- **Customer Storefront (`/store/:slug`)**:
  - Store branding, logo, contact phone, and WhatsApp link
  - Self-service order tracking with reference code & phone number
  - Product catalog supporting decimal pricing and fractional units (e.g., ¼ kg, ½ kg, grams, litres)
  - Interactive cart and direct WhatsApp-first checkout formatting
- **Store Admin Dashboard (`/dashboard`)**:
  - Real-time catalog capacity against package limits
  - Store profile and delivery coverage (All India vs. specific service areas)
  - Logo upload (PNG/JPG/WebP up to 2 MB)
  - Add/edit products, toggle availability (freeing slots without losing catalog data), and hide items
  - Order management and status updates (pending, confirmed, preparing, completed, cancelled)
- **Owner Control Center (`/admin`)**:
  - Platform administrator dashboard for managing tenants, registered user accounts, cross-store orders, and audit history
  - User onboarding and store creation
  - Store publication, suspension, and restoration
- **Theme Support**: Seamless dark/light theme toggle with persistent user preference.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend / Database**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Payments**: Cashfree SDK integration for package checkouts

## Development

```bash
npm install
npm run dev
```

App runs on port 3000 (`http://localhost:3000`).
