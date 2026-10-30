from __future__ import annotations

import asyncio
import base64
import hmac
import json
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from influxdb_client import InfluxDBClient

from .config import settings
from .mqtt_bridge import MqttBridge
from .schemas import CommandResult, IndicatorCommand

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("labsentinel.gateway")
basic = HTTPBasic(auto_error=False)
influx: InfluxDBClient | None = None
bridge: MqttBridge | None = None


def require_operator(credentials: Annotated[HTTPBasicCredentials | None, Depends(basic)]) -> str:
    if credentials is None or credentials.username != "operator" or not hmac.compare_digest(
        credentials.password, settings.ui_operator_password
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Operator sign-in required", headers={"WWW-Authenticate": "Basic"})
    return credentials.username


@asynccontextmanager
async def lifespan(app: FastAPI):
    global influx, bridge
    influx = InfluxDBClient(url=settings.influx_url, token=settings.influx_token, org=settings.influx_org)
    bridge = MqttBridge(settings, influx)
    bridge.start(asyncio.get_running_loop())
    yield
    if bridge:
        bridge.stop()
    if influx:
        influx.close()


app = FastAPI(title="LabSentinel Gateway", version="0.1.0", lifespan=lifespan)


@app.get("/healthz")
def healthz():
    return {"ok": True, "mqtt_connected": bool(bridge and bridge.connected.is_set()),
            "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/summary")
def summary(_: Annotated[str, Depends(require_operator)]):
    if bridge is None:
        raise HTTPException(503, "Gateway is starting")
    snapshot = bridge.latest_snapshot()
    last_received = snapshot.get("last_received_at")
    stale = True
    if last_received:
        try:
            stale = (datetime.now(timezone.utc) - datetime.fromisoformat(last_received)).total_seconds() > 15
        except ValueError:
            stale = True
    return {"mode": "actual", "mqtt_connected": bridge.connected.is_set(), "stale": stale,
            "last_received_at": last_received, "device": snapshot}


@app.get("/api/history")
async def history(window: str = "6h", _: str = Depends(require_operator)):
    if influx is None:
        raise HTTPException(503, "InfluxDB is not available")
    durations = {"1h": "1h", "6h": "6h", "24h": "24h", "7d": "7d"}
    if window not in durations:
        raise HTTPException(422, "window must be one of 1h, 6h, 24h, or 7d")
    query = f'''from(bucket: "{settings.influx_bucket}")
  |> range(start: -{durations[window]})
  |> filter(fn: (r) => r._measurement == "lab_equipment" and r.device_id == "{settings.device_id}")
  |> filter(fn: (r) => contains(value: r._field, set: ["temperature_c", "humidity_pct", "light_raw", "light_lux", "proximity_raw", "pitch_deg", "roll_deg", "motion_event", "actual_output"]))
  |> aggregateWindow(every: 10s, fn: last, createEmpty: false)
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
'''
    try:
        tables = await asyncio.to_thread(influx.query_api().query, query, org=settings.influx_org)
    except Exception as exc:
        logger.exception("Influx query failed")
        raise HTTPException(503, "History is temporarily unavailable") from exc
    points = []
    for table in tables:
        for record in table.records:
            points.append({key: (record.values.get(key).isoformat() if isinstance(record.values.get(key), datetime)
                                  else record.values.get(key))
                           for key in ("_time", "temperature_c", "humidity_pct", "light_raw", "light_lux",
                                       "proximity_raw", "pitch_deg", "roll_deg", "motion_event", "actual_output")
                           if record.values.get(key) is not None})
    return {"mode": "actual", "window": window, "points": points}


@app.post("/api/commands/indicator", response_model=CommandResult)
async def command_indicator(body: IndicatorCommand, _: Annotated[str, Depends(require_operator)]):
    if bridge is None or not bridge.connected.is_set():
        raise HTTPException(503, "Device command channel is unavailable")
    result = await bridge.publish_indicator(body.state)
    return CommandResult(**result)


@app.get("/api/stream")
async def stream(request: Request, _: Annotated[str, Depends(require_operator)]):
    if bridge is None:
        raise HTTPException(503, "Gateway is starting")
    subscriber = bridge.add_subscriber()

    async def events():
        try:
            yield "event: ready\ndata: {}\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(subscriber.get(), timeout=15)
                    yield f"event: {event.get('type', 'update')}\ndata: {json.dumps(event, separators=(',', ':'))}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            bridge.remove_subscriber(subscriber)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


