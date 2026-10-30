# System Architecture

## Data and control flow

```text
RT-Spark sensors and button/LED
  -> STM32Cube HAL/LL + FreeRTOS tasks
  -> MQTT telemetry/status/ack topics
  -> authenticated local Mosquitto
  -> Python gateway: validate, ingest, query, command, live event stream
  -> InfluxDB -> Grafana history and alerts
  -> React operator UI via same-origin HTTP/SSE
```

The browser does not receive broker or Influx credentials and never talks directly to MQTT. The gateway is the boundary between browser requests, MQTT topics, and InfluxDB. The public deployment is demo-only; the local actual mode reads from the gateway and never substitutes fixture data for missing device values.

## Firmware tasks and timing

| Task | Target cadence / priority | Responsibility |
|---|---|---|
| Motion acquisition | 50 Hz, highest acquisition priority | Read ICM20608 after bus mapping; compute pitch/roll and a one-second motion summary |
| Environment/optical acquisition | Every 2 seconds, medium priority | Read AHT10 and AP3216C; preserve units, status, and monotonic sequence |
| Control | Event-driven, medium-high priority | Validate command, debounce local button, drive verified LED, maintain actual state, enqueue acknowledgment |
| Communications | Publish every 5 seconds, low priority | Manage Wi-Fi/MQTT reconnects, publish telemetry/status, receive commands without blocking sensing |
| Health/diagnostics | Every second, low priority | Record task heartbeat, minimum heap, stack high-water marks, and faults |

Use queues for sensor snapshots, commands, and acknowledgments; event groups for connectivity; a mutex only where the verified bus is shared. Use `vTaskDelayUntil` for periodic work. HAL timekeeping and FreeRTOS SysTick ownership must be verified before enabling HAL timeouts under the scheduler.

## Time and outage behavior

Each telemetry message carries boot ID, monotonic uptime, and sample sequence. Use a verified RTC if present; otherwise the gateway assigns UTC receive time and retains device uptime/sequence. Sensor and control tasks keep running through outages. Do not promise replay unless fitted nonvolatile storage and its driver are verified; report missing intervals and resume fresh telemetry after reconnection.

