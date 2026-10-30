# LabSentinel dashboard

The Vite app has two build modes:

- **Demo:** deterministic fixture readings, a simulated ON/OFF control, and explicitly labeled demo walkthrough stamps. The Vercel build always uses this mode and has no MQTT or database credentials.
- **Actual:** reads only from the local gateway. It asks for the operator password, keeps it in memory for the current tab, polls actual status/history, and sends an indicator request only to the local gateway.

## Local preview

```sh
cd frontend
npm install
npm run dev
```

The default development server is a safe demo. Open <http://localhost:5173>. To exercise the actual gateway UI, start Vite with `VITE_DATA_MODE=actual npm run dev` and keep the gateway bound to loopback. For the complete stack, use the root Docker Compose instructions instead: actual mode is built into the local Nginx UI and `/api` is proxied to the gateway.

The public production build is always demo-only:

```sh
npm run build:demo
```

It contains no path capable of publishing an MQTT message. Demo controls update the browser’s simulator state only.
