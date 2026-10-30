# LabSentinel — BCA182 Project 2

LabSentinel is an RT-Spark STM32F407 project for logging, monitoring, and controlling conditions at a lab equipment station.

## Project status

The Project 2 directory began with the assignment PDF only. The assigned board is currently unavailable, so the hardware inventory, pin map, Wi-Fi transport, physical sensor readings, upload, and final reliability tests remain pending. No live values should be reported until produced by the actual board.

The repository has two data modes:

- **Demo:** fixed, clearly labeled fixture data for the public web preview. It cannot send physical commands and is never written to the actual measurement bucket.
- **Actual:** local gateway mode. It shows real device data when the verified board is connected; if no device data exists, it shows disconnected/stale state rather than inventing readings.

## System

- Firmware: PlatformIO, STM32Cube HAL/LL, FreeRTOS. Arduino is not used.
- Local services: Mosquitto, InfluxDB 2.x, Grafana, and the Python gateway/API.
- Operator UI: Vite, React, TypeScript; production hosting is demo-only.

See `docs/ARCHITECTURE.md`, `docs/HARDWARE_INVENTORY.md`, and `docs/MQTT_CONTRACT.md` before enabling any board peripheral.

## Local service setup

1. Copy `.env.example` to `.env` and replace every placeholder with local values. Never commit `.env`.
2. Start Mosquitto, InfluxDB, Grafana, and the gateway with `docker compose up --build`.
3. Provision the local Influx bucket and Grafana dashboard as described in `services/gateway/README.md` and `docs/ARCHITECTURE.md`.
4. Run the operator UI with `cd frontend && npm ci && npm run dev`; this is a safe demo preview. To connect the UI to the local gateway, use `npm run dev:actual` or start the full Docker Compose stack.

The gateway and dashboards are intended for a trusted local network. Configure a broker password file and ACL before connecting hardware. Public hosting contains demo mode only and has no device secrets. Dashboard build and run details are in `frontend/README.md`.

## Public demo

The interactive, demo-only dashboard is live at <https://labsentinel.vercel.app>. It uses illustrative readings and simulated controls; it does not connect to the board or local gateway.

To use `labsentinel.joalvergs.tech`, add this record at the DNS provider for `joalvergs.tech` (currently Name.com):

| Type | Host | Value |
| --- | --- | --- |
| A | `labsentinel` | `76.76.21.21` |

After DNS propagates, Vercel can issue the certificate and the custom URL will route to the demo. The actual-data version remains local and requires a configured gateway and the verified RT-Spark hardware.

## Firmware

Run `pio run` from this directory for the compile-only STM32F407ZG foundation. The current MCU profile is not a validated RT-Spark board definition. The ST-LINK protocol entry is required by PlatformIO's board configuration; it does not verify that the assigned board uses ST-LINK. Do not run an upload target until the exact board revision, clock, pin map, memory/linker configuration, debugger, and recovery procedure are verified and recorded in `docs/HARDWARE_INVENTORY.md`.

Run hardware-independent logic checks with `sh tools/run_host_tests.sh`. Gateway schema tests are in `services/gateway/tests/` and can be run in a Python environment with `services/gateway/requirements-dev.txt` installed.

## Submission evidence

Fill the matrix in `docs/VERIFICATION.md` from observed tests. Store approved evidence under `evidence/`; do not put credentials, generated data, or unverified claims in the repository. The assignment PDF remains the authoritative rubric.

