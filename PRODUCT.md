# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React, and TypeScript for the operator dashboard; Python FastAPI, Paho MQTT, and the InfluxDB Python client for the local gateway; STM32Cube HAL/LL and FreeRTOS with PlatformIO for firmware.

## Users

The primary users are BCA182 students operating and demonstrating the system. Instructors and classmates need to inspect live status, historical measurements, command behavior, and verification evidence.

## Product Purpose

LabSentinel monitors conditions and handling activity at a lab equipment station using the RT-Spark board. Success means real board readings flow through MQTT into InfluxDB and appear in both an operator dashboard and Grafana, while a user can safely control a fitted output and verify its actual state.

## Positioning

The STM32 board remains responsible for sensing and physical control. The local gateway validates and persists device messages; the web dashboard is an operator surface, and Grafana remains the historical engineering view.

## Operating Context

The system is evaluated on a local workstation and the assigned RT-Spark board. The board is currently unavailable in this workspace. The production web build may run in a clearly labeled demo mode; the local actual-data mode must never replace missing sensor values with generated readings.

## Capabilities and Constraints

- Required sensors: AHT10 temperature/humidity, AP3216C light/proximity, and ICM20608 accelerometer/gyroscope.
- Required firmware stack: PlatformIO, STM32Cube HAL/LL, and FreeRTOS. Arduino is excluded.
- Local services: authenticated Mosquitto, InfluxDB, Grafana, and a Python gateway/API.
- The board revision, pin map, Wi-Fi module, storage, and physical output mappings are unverified until the actual board is inspected. Do not upload or claim hardware behavior before that gate.
- The controlled output is the verified onboard indicator LED. Remote ON/OFF commands and the local button are serialized by the control task.
- The public demo uses conspicuously labeled fixture data and cannot send hardware commands. Actual mode uses the local gateway and real device messages.

## Brand Commitments

Use the working name LabSentinel. The dashboard should feel clear and lively, with purposeful motion and noncompetitive progress achievements. Gamification must never hide stale data, alter sensor values, delay control, or imply unverified hardware behavior.

## Evidence on Hand

The Project 2 PDF is the authoritative assignment. No RT-Spark board, board photographs, verified pin map, device readings, or hardware test results are available in the Project 2 folder.

## Product Principles

- Show whether each value is real, demo, stale, or unavailable.
- Keep requested command state separate from actual output state.
- Keep embedded sensing and local control responsive when networking fails.
- Reward verified milestones, not fabricated performance.
- Make the dashboard usable with touch, keyboard, assistive technology, and reduced motion.

## Accessibility & Inclusion

Use responsive layouts, visible keyboard focus, semantic labels and live announcements, status cues beyond color, minimum 44 px touch targets, and a reduced-motion alternative.

