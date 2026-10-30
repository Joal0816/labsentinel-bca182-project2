from __future__ import annotations

import asyncio
import json
import logging
import queue
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

import paho.mqtt.client as mqtt
from influxdb_client import InfluxDBClient, Point, WritePrecision

from .config import Settings
from .schemas import CommandAck, DeviceStatus, Telemetry

logger = logging.getLogger(__name__)


class MqttBridge:
    def __init__(self, settings: Settings, influx: InfluxDBClient):
        self.settings = settings
        self.influx = influx
        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"labsentinel-gateway-{settings.device_id}",
            protocol=mqtt.MQTTv311,
        )
        self.client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.connected = threading.Event()
        self.stop_event = threading.Event()
        self.write_queue: queue.Queue[tuple[str, dict[str, Any], datetime]] = queue.Queue(maxsize=512)
        self.latest: dict[str, Any] = {"state": "offline", "actual_output": "UNKNOWN"}
        self.latest_lock = threading.Lock()
        self.ack_waiters: dict[str, tuple[asyncio.AbstractEventLoop, asyncio.Future]] = {}
        self.ack_lock = threading.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self.subscribers_lock = threading.Lock()
        self.writer_thread = threading.Thread(target=self._write_worker, name="influx-writer", daemon=True)

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self.writer_thread.start()
        self.client.connect_async(self.settings.mqtt_host, self.settings.mqtt_port, keepalive=30)
        self.client.loop_start()

    def stop(self) -> None:
        self.stop_event.set()
        self.client.disconnect()
        self.client.loop_stop()
        self.writer_thread.join(timeout=2)

    def _on_connect(self, client, userdata, flags, reason_code, properties) -> None:
        if reason_code.is_failure:
            logger.warning("MQTT connection refused: %s", reason_code)
            return
        self.connected.set()
        root = f"{self.settings.topic_prefix}/{self.settings.group_id}/+"
        for suffix in ("telemetry", "status", "ack"):
            client.subscribe(f"{root}/{suffix}", qos=1)
        self._publish_event({"type": "gateway", "mqtt_connected": True})

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties) -> None:
        self.connected.clear()
        self._publish_event({"type": "gateway", "mqtt_connected": False})

    def _on_message(self, client, userdata, message) -> None:
        received_at = datetime.now(timezone.utc)
        parts = message.topic.split("/")
        if len(parts) != 4 or parts[0] != self.settings.topic_prefix or parts[3] not in ("telemetry", "status", "ack"):
            return
        group_id, device_id, suffix = parts[1], parts[2], parts[3]
        if group_id != self.settings.group_id or device_id != self.settings.device_id:
            return
        try:
            raw = json.loads(message.payload.decode("utf-8"))
            if suffix == "telemetry":
                parsed = Telemetry.model_validate(raw)
                if parsed.device_id != device_id:
                    raise ValueError("topic and payload device IDs differ")
                record = parsed.model_dump(mode="json", exclude_none=True)
            elif suffix == "status":
                parsed = DeviceStatus.model_validate(raw)
                if parsed.device_id != device_id:
                    raise ValueError("topic and payload device IDs differ")
                record = parsed.model_dump(mode="json", exclude_none=True)
            else:
                parsed = CommandAck.model_validate(raw)
                if parsed.device_id != device_id:
                    raise ValueError("topic and payload device IDs differ")
                record = parsed.model_dump(mode="json", exclude_none=True)
        except Exception as exc:
            logger.warning("Rejected invalid MQTT payload on %s: %s", message.topic, exc)
            return

        event = {"type": suffix, "received_at": received_at.isoformat(), "data": record}
        if suffix in ("telemetry", "status"):
            with self.latest_lock:
                self.latest.update(record)
                self.latest["last_received_at"] = received_at.isoformat()
                self.latest["device_id"] = device_id
        try:
            self.write_queue.put_nowait((suffix, record, received_at))
        except queue.Full:
            logger.error("Influx write queue full; dropping %s from %s", suffix, device_id)
        if suffix == "ack":
            self._resolve_ack(record)
        self._publish_event(event)

    def _publish_event(self, event: dict[str, Any]) -> None:
        if self.loop is None or self.loop.is_closed():
            return
        self.loop.call_soon_threadsafe(self._broadcast, event)

    def _broadcast(self, event: dict[str, Any]) -> None:
        for subscriber in tuple(self.subscribers):
            try:
                subscriber.put_nowait(event)
            except asyncio.QueueFull:
                try:
                    subscriber.get_nowait()
                    subscriber.put_nowait(event)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    pass

    def add_subscriber(self) -> asyncio.Queue[dict[str, Any]]:
        subscriber: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=32)
        with self.subscribers_lock:
            self.subscribers.add(subscriber)
        return subscriber

    def remove_subscriber(self, subscriber: asyncio.Queue[dict[str, Any]]) -> None:
        with self.subscribers_lock:
            self.subscribers.discard(subscriber)

    def latest_snapshot(self) -> dict[str, Any]:
        with self.latest_lock:
            return dict(self.latest)

    async def publish_indicator(self, state: str) -> dict[str, Any]:
        command_id = str(uuid.uuid4())
        topic = f"{self.settings.topic_root}/cmd/indicator"
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        with self.ack_lock:
            self.ack_waiters[command_id] = (loop, future)
        payload = json.dumps({"command_id": command_id, "command": state}, separators=(",", ":"))
        info = self.client.publish(topic, payload, qos=1, retain=False)
        if info.rc != mqtt.MQTT_ERR_SUCCESS:
            with self.ack_lock:
                self.ack_waiters.pop(command_id, None)
            return {"command_id": command_id, "requested_state": state, "accepted": False,
                    "actual_state": "UNKNOWN", "reason": "mqtt_publish_failed", "timed_out": False}
        try:
            self.write_queue.put_nowait(("command", {
                "device_id": self.settings.device_id,
                "command_id": command_id,
                "requested_state": state,
            }, datetime.now(timezone.utc)))
        except queue.Full:
            logger.error("Influx write queue full; command request %s was not persisted", command_id)
        self._publish_event({"type": "command", "data": {
            "device_id": self.settings.device_id, "command_id": command_id,
            "requested_state": state, "state": "pending",
        }})
        try:
            ack = await asyncio.wait_for(future, timeout=self.settings.command_ack_timeout_seconds)
            return {"command_id": command_id, "requested_state": state,
                    "accepted": ack.get("accepted"), "actual_state": ack.get("actual_state", "UNKNOWN"),
                    "reason": ack.get("reason"), "timed_out": False}
        except asyncio.TimeoutError:
            return {"command_id": command_id, "requested_state": state, "accepted": None,
                    "actual_state": "UNKNOWN", "reason": "ack_timeout", "timed_out": True}
        finally:
            with self.ack_lock:
                self.ack_waiters.pop(command_id, None)

    def _resolve_ack(self, record: dict[str, Any]) -> None:
        with self.ack_lock:
            waiter = self.ack_waiters.get(record.get("command_id", ""))
        if waiter is None:
            return
        loop, future = waiter
        if loop.is_closed():
            return

        def finish() -> None:
            if not future.done():
                future.set_result(record)

        loop.call_soon_threadsafe(finish)

    def _write_worker(self) -> None:
        writer = self.influx.write_api()
        while not self.stop_event.is_set() or not self.write_queue.empty():
            try:
                suffix, record, received_at = self.write_queue.get(timeout=0.25)
            except queue.Empty:
                continue
            try:
                point = self._point(suffix, record, received_at)
                if point is not None:
                    writer.write(bucket=self.settings.influx_bucket, org=self.settings.influx_org,
                                 record=point, write_precision=WritePrecision.MS)
            except Exception:
                logger.exception("Influx write failed for %s", suffix)
            finally:
                self.write_queue.task_done()
        writer.close()

    def _point(self, suffix: str, record: dict[str, Any], received_at: datetime) -> Point | None:
        device_id = record.get("device_id", self.settings.device_id)
        point = (Point("lab_equipment")
                 .tag("group_id", self.settings.group_id)
                 .tag("device_id", device_id)
                 .time(received_at, WritePrecision.MS))
        if suffix == "telemetry":
            values = {key: value for key, value in record.items()
                      if key not in {"device_id", "boot_id", "device_time"} and value is not None}
            point = point.field("boot_id", str(record.get("boot_id", "")))
            point = point.field("record_type", "telemetry")
        elif suffix == "status":
            values = {key: value for key, value in record.items()
                      if key not in {"device_id"} and value is not None}
            point = point.field("record_type", "status")
        elif suffix == "command":
            values = {key: value for key, value in record.items() if key != "device_id" and value is not None}
            point = point.field("record_type", "command_request")
        else:
            values = {key: value for key, value in record.items()
                      if key not in {"device_id", "device_time"} and value is not None}
            point = point.field("record_type", "command_ack")
        for key, value in values.items():
            if isinstance(value, (bool, int, float, str)):
                point = point.field(key, value)
        return point

