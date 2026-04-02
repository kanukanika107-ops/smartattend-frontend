# SmartAttend Frontend Deployment

This frontend is ready to deploy as a Vite static app.

## Required environment variable

Set:

```bash
VITE_API_URL=https://smartattend-backend-5irf.onrender.com
```

If you skip it, the app falls back to the live backend URL above.

## Build command

```bash
npm install
npm run build
```

## Output folder

Deploy the `dist/` folder.

## Notes

- Login is the first screen.
- Backend URL is locked in the dashboard UI for demo stability.
- Socket.IO uses the same backend URL as the API.
- No bulk import UI is shown in the dashboard.
