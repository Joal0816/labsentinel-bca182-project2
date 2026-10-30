#include "motion_detector.h"

#include <math.h>
#include <stddef.h>

static float absolute_float(float value)
{
    return value < 0.0f ? -value : value;
}

static float angular_distance(float first, float second)
{
    float difference = fmodf(first - second, 360.0f);
    if (difference > 180.0f) difference -= 360.0f;
    if (difference < -180.0f) difference += 360.0f;
    return absolute_float(difference);
}

void motion_detector_init(MotionDetector *detector, float acceleration_rms_threshold_g,
                          float tilt_threshold_deg, uint32_t assert_duration_ms,
                          uint32_t clear_duration_ms)
{
    if (detector == NULL) return;
    *detector = (MotionDetector){
        .acceleration_rms_threshold_g = acceleration_rms_threshold_g,
        .tilt_threshold_deg = tilt_threshold_deg,
        .assert_duration_ms = assert_duration_ms,
        .clear_duration_ms = clear_duration_ms,
    };
}

void motion_detector_set_baseline(MotionDetector *detector, float pitch_deg, float roll_deg)
{
    if (detector == NULL) return;
    detector->baseline_pitch_deg = pitch_deg;
    detector->baseline_roll_deg = roll_deg;
    detector->baseline_ready = true;
}

bool motion_detector_update(MotionDetector *detector, float pitch_deg, float roll_deg,
                            float dynamic_acceleration_rms_g, uint32_t now_ms)
{
    if (detector == NULL || !detector->baseline_ready ||
        !isfinite(pitch_deg) || !isfinite(roll_deg) || !isfinite(dynamic_acceleration_rms_g)) {
        return false;
    }

    const bool tilted = angular_distance(pitch_deg, detector->baseline_pitch_deg) >= detector->tilt_threshold_deg ||
                        angular_distance(roll_deg, detector->baseline_roll_deg) >= detector->tilt_threshold_deg;
    const bool moving = tilted || dynamic_acceleration_rms_g >= detector->acceleration_rms_threshold_g;

    if (moving) {
        detector->quiet_active = false;
        if (!detector->candidate_active) {
            detector->candidate_since_ms = now_ms;
            detector->candidate_active = true;
        }
        if ((uint32_t)(now_ms - detector->candidate_since_ms) >= detector->assert_duration_ms) {
            detector->event_active = true;
        }
    } else {
        detector->candidate_active = false;
        if (detector->event_active) {
            if (!detector->quiet_active) {
                detector->quiet_since_ms = now_ms;
                detector->quiet_active = true;
            }
            if ((uint32_t)(now_ms - detector->quiet_since_ms) >= detector->clear_duration_ms) {
                detector->event_active = false;
                detector->quiet_active = false;
            }
        }
    }

    return detector->event_active;
}

