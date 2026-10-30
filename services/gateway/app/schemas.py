from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OutputState(str, Enum):
    ON = "ON"
    OFF = "OFF"
    UNKNOWN = "UNKNOWN"


class Telemetry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(min_length=1, max_length=64)
    boot_id: str = Field(min_length=1, max_length=64)
    seq: int = Field(ge=0)
    uptime_ms: int = Field(ge=0)
    temperature_c: float | None = Field(default=None, ge=-40, le=85)
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    light_raw: int | None = Field(default=None, ge=0)
    light_lux: float | None = Field(default=None, ge=0)
    proximity_raw: int | None = Field(default=None, ge=0)
    accel_x_g: float | None = None
    accel_y_g: float | None = None
    accel_z_g: float | None = None
    gyro_x_dps: float | None = None
    gyro_y_dps: float | None = None
    gyro_z_dps: float | None = None
    pitch_deg: float | None = Field(default=None, ge=-180, le=180)
    roll_deg: float | None = Field(default=None, ge=-180, le=180)
    motion_event: bool | None = None
    actual_output: OutputState = OutputState.UNKNOWN
    device_time: datetime | None = None

    @field_validator(
        "temperature_c", "humidity_pct", "light_lux", "accel_x_g", "accel_y_g",
        "accel_z_g", "gyro_x_dps", "gyro_y_dps", "gyro_z_dps", "pitch_deg", "roll_deg",
    )
    @classmethod
    def finite_numbers(cls, value: float | None) -> float | None:
        if value is not None and (value != value or value in (float("inf"), float("-inf"))):
            raise ValueError("numeric fields must be finite")
        return value


class DeviceStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(min_length=1, max_length=64)
    state: Literal["online", "offline"]
    wifi_connected: bool | None = None
    mqtt_connected: bool | None = None
    actual_output: OutputState = OutputState.UNKNOWN
    fault_code: str | None = Field(default=None, max_length=64)


class CommandAck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(min_length=1, max_length=64)
    command_id: str = Field(min_length=1, max_length=64)
    accepted: bool
    actual_state: OutputState
    reason: str | None = Field(default=None, max_length=120)
    device_time: datetime | None = None


class IndicatorCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: Literal["ON", "OFF"]


class CommandResult(BaseModel):
    command_id: str
    requested_state: str
    accepted: bool | None
    actual_state: OutputState
    reason: str | None = None
    timed_out: bool = False

