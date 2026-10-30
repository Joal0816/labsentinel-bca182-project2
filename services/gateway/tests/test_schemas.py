import pytest
from pydantic import ValidationError

from app.schemas import DeviceStatus, IndicatorCommand, OutputState, Telemetry


def test_valid_telemetry_preserves_units_and_state():
    record = Telemetry.model_validate({
        "device_id": "lab-sentinel-01",
        "boot_id": "boot-a1",
        "seq": 7,
        "uptime_ms": 35000,
        "temperature_c": 24.7,
        "humidity_pct": 51.2,
        "light_raw": 120,
        "proximity_raw": 31,
        "accel_x_g": 0.01,
        "pitch_deg": 2.0,
        "roll_deg": -1.0,
        "motion_event": False,
        "actual_output": "OFF",
    })
    assert record.temperature_c == 24.7
    assert record.actual_output is OutputState.OFF


@pytest.mark.parametrize("payload", [
    {"device_id": "d", "boot_id": "b", "seq": 0, "uptime_ms": 0, "humidity_pct": 101},
    {"device_id": "d", "boot_id": "b", "seq": 0, "uptime_ms": 0, "temperature_c": float("nan")},
    {"device_id": "d", "boot_id": "b", "seq": 0, "uptime_ms": 0, "fabricated": 1},
])
def test_invalid_telemetry_is_rejected(payload):
    with pytest.raises(ValidationError):
        Telemetry.model_validate(payload)


def test_status_and_command_are_strict():
    assert DeviceStatus(device_id="d", state="online").state == "online"
    assert IndicatorCommand(state="ON").state == "ON"
    with pytest.raises(ValidationError):
        IndicatorCommand(state="BLINK")
    with pytest.raises(ValidationError):
        DeviceStatus(device_id="d", state="fault")

