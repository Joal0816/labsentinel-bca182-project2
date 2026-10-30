#ifndef LABSENTINEL_MOTION_DETECTOR_H
#define LABSENTINEL_MOTION_DETECTOR_H

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    float baseline_pitch_deg;
    float baseline_roll_deg;
    float acceleration_rms_threshold_g;
    float tilt_threshold_deg;
    uint32_t assert_duration_ms;
    uint32_t clear_duration_ms;
    uint32_t candidate_since_ms;
    uint32_t quiet_since_ms;
    bool baseline_ready;
    bool event_active;
    bool candidate_active;
    bool quiet_active;
} MotionDetector;

void motion_detector_init(MotionDetector *detector, float acceleration_rms_threshold_g,
                          float tilt_threshold_deg, uint32_t assert_duration_ms,
                          uint32_t clear_duration_ms);
void motion_detector_set_baseline(MotionDetector *detector, float pitch_deg, float roll_deg);
bool motion_detector_update(MotionDetector *detector, float pitch_deg, float roll_deg,
                            float dynamic_acceleration_rms_g, uint32_t now_ms);

#endif

