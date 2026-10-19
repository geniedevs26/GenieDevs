# GenieDevs

GenieDevs is being built step by step as a small-business storefront builder.

## Current stage
This commit is the public landing page only. It is suitable for the first Vercel deployment and does **not** yet provide live signup, product management, order storage, or paid-plan activation. Those features must be connected and tested before advertising the site as a working store builder.

## Files
- `index.html` — responsive landing page
- `vercel.json` — basic Vercel configuration

## Deploy on Vercel
1. Import the `geniedevs26/GenieDevs` repository in Vercel.
2. Keep Framework Preset as **Other**.
3. Leave Build Command and Output Directory empty/default.
4. Deploy.
5. Open the deployment URL and check the home page.

## Next implementation stages
1. Connect Supabase Auth and the existing database without deleting existing tables.
2. Add tenant/store setup and owner dashboard.
3. Add product CRUD with server-side/RLS enforcement of plan limits.
4. Add public store routes and order submission.
5. Test access controls and complete an end-to-end order flow.

Do not treat pricing cards as payment functionality. Payment collection and paid-plan activation are not implemented in this stage.
