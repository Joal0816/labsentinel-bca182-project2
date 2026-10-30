# MQTT Contract

Topic root: `bca182/{group_id}/{device_id}`. Group and device identifiers are local configuration values and must be unique.

| Topic suffix | Direction | Payload purpose |
|---|---|---|
| `/telemetry` | Device publishes | Device/boot IDs, sequence, uptime, temperature C, humidity %, light reading, proximity count, acceleration g, gyro degrees/s, pitch/roll, motion event, actual output |
| `/status` | Device publishes | Online/offline, Wi-Fi/MQTT state, actual output, and fault/status codes; online/offline status is retained and has an offline Last Will |
| `/cmd/indicator` | Device subscribes | JSON command with command ID and state `ON` or `OFF`; command messages are not retained |
| `/ack` | Device publishes | Command ID, accepted/rejected result, actual state, and reason/status |

Use QoS 1 for commands and acknowledgments. Telemetry values must be finite and have verified units. AP3216C light values are labelled in lux only after a valid conversion; otherwise the dashboard says “raw counts.” Proximity is a sensor count, not distance in millimeters.

The gateway validates shape, types, identifiers, and plausible sensor ranges. Invalid payloads are counted and rejected; they never become fabricated Influx points. The gateway records UTC receive time, group/device tags, and device sequence/uptime. Requested state and actual output state are stored separately.

