# Local gateway setup

The gateway is the only service that holds MQTT and InfluxDB credentials. It validates incoming telemetry/status/ack payloads, writes points using UTC receive time, provides authenticated summary/history/command APIs, and streams live MQTT events to the local UI.

## First-time setup

1. Copy the root `.env.example` to `.env`; set unique IDs and local-only credentials.
2. Create the broker password file before starting Compose. With Docker installed, run from the project root:

   ```sh
   mkdir -p services/mosquitto
   docker run --rm -it -v "$PWD/services/mosquitto:/mosquitto/config" eclipse-mosquitto:2 mosquitto_passwd -c /mosquitto/config/passwd lab-sentinel-service
   docker run --rm -it -v "$PWD/services/mosquitto:/mosquitto/config" eclipse-mosquitto:2 mosquitto_passwd /mosquitto/config/passwd lab-sentinel-device
   ```

   Use the matching local values in `.env`. The ACL is deliberately limited to the LabSentinel topics.
3. Start the stack with `docker compose up --build`.
4. The actual UI is available at `http://127.0.0.1:8080`; Grafana is at `http://127.0.0.1:3000`. Both ports are loopback-bound by default. Do not expose the operator API to a public network without TLS and a reviewed access-control setup.

## Browser API

- `GET /api/summary` — latest actual snapshot, MQTT state, last-data time, and stale flag.
- `GET /api/history?window=1h|6h|24h|7d` — InfluxDB history.
- `GET /api/stream` — authenticated server-sent events for telemetry, status, acknowledgments, and gateway state.
- `POST /api/commands/indicator` — authenticated `{"state":"ON"}` or `{"state":"OFF"}`. The response contains command ID, acceptance, actual state, and timeout/rejection reason.
- `GET /healthz` — process and MQTT readiness only; contains no measurements.

The frontend sends HTTP Basic credentials only to the loopback gateway and keeps them in memory. The public demo build does not use this API and has no broker/database credentials.

