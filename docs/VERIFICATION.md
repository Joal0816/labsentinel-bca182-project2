# Verification Matrix

Record observed results and evidence links only after the test is performed. Host fixtures and simulated UI data are not live-device evidence.

| Test | Expected behavior | Observed behavior | Result / evidence |
|---|---|---|---|
| PlatformIO build | STM32Cube firmware compiles for the documented MCU profile | Pending | Pending |
| Board identity and pin inventory | Exact revision and each enabled mapping match the physical board and matching documentation | Pending board access | Pending |
| AHT10 | Controlled temperature/humidity changes produce valid, unit-labelled readings | Pending board access | Pending |
| AP3216C | Repeated light and near-object changes produce readings with honest units | Pending board access | Pending |
| ICM20608 | Stationary baseline and controlled fixture movement produce raw/derived values and event | Pending board access | Pending |
| FreeRTOS concurrency | Sensor, control, communication, and health heartbeats continue concurrently | Pending board access | Pending |
| MQTT to InfluxDB/Grafana | Real device messages persist with plausible timestamps and consistent fields | Pending board access | Pending |
| Valid commands | ON and OFF change the physical LED; acknowledgment reports actual state | Pending board access | Pending |
| Invalid/duplicate commands | Invalid input is rejected without state change; duplicate command ID is idempotent | Pending | Pending |
| Network recovery | Sensing/local control continue; MQTT resumes without reflashing | Pending board access | Pending |
| Ten response trials | Record each response and min/median/max; target median <1 s and max <2 s on stable local network | Pending board access | Pending |
| Thirty-minute run | At 5-second cadence, compare 360 expected telemetry messages to received; log resets, gaps, task health, faults | Pending board access | Pending |
| Operator UI | Demo/live labels, stale/offline/ack states, responsive layout, reduced motion, keyboard/touch | Pending implementation | Pending |

