# Hardware Inventory and Bring-up Record

**Status: PENDING.** The physical RT-Spark board is not available in the current workspace. The project brief names expected components; no pin, bus, module-population, clock, or output mapping below is verified.

| Component/resource | Intended use | Mapping / evidence | Status |
|---|---|---|---|
| RT-Spark / STM32F407ZGT6 | Firmware target | Board revision, MCU marking, clock, memory, startup, upload/debug path | Pending board inspection |
| AHT10 | Temperature and relative humidity | Bus, address, power, repeated readings against a reference | Pending |
| AP3216C | Ambient light and proximity | Bus, address, raw units/calibration, light and near-object trials | Pending |
| ICM20608 | Acceleration/gyroscope and fixture movement | Bus, address, ODR/range, static and controlled movement trials | Pending |
| Wi-Fi module | MQTT transport | Module/firmware, bus or UART, supported TCP/TLS behavior | Pending |
| User button | Local indicator toggle | GPIO, active level, debounce behavior | Pending |
| User indicator LED | Remote ON/OFF output and status | GPIO, polarity, safe startup state | Pending |
| Display, buzzer, LED matrix, RGB/IR modules | Inventory and assess for relevant feedback | Exact fitted module and verified mapping | Pending |
| RTC | Device wall clock if fitted and usable | Module, interface, set/sync/read test | Pending |
| SPI Flash / microSD | Bounded outage buffer only if fitted and feasible | Capacity, interface, driver, persistence test | Pending |
| UART/debug interface | Diagnostics and upload | Connector, pins, baud, probe | Pending |

Do not fill the mapping column from a different board revision or from a generic STM32F407 manifest. Photograph both sides of the actual board and cite the matching schematic/manual before enabling a peripheral.

