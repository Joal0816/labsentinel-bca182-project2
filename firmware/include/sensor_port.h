#ifndef LABSENTINEL_SENSOR_PORT_H
#define LABSENTINEL_SENSOR_PORT_H

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    float temperature_c;
    float humidity_pct;
    uint16_t light_raw;
    uint16_t proximity_raw;
    uint32_t sample_sequence;
    uint32_t uptime_ms;
    bool environment_valid;
    bool optical_valid;
} EnvironmentSample;

typedef struct {
    float accel_x_g;
    float accel_y_g;
    float accel_z_g;
    float gyro_x_dps;
    float gyro_y_dps;
    float gyro_z_dps;
    float pitch_deg;
    float roll_deg;
    float dynamic_accel_rms_g;
    bool valid;
    bool motion_event;
} MotionSample;

/* These adapters intentionally fail closed until the physical bus map is verified. */
bool sensor_port_read_environment(EnvironmentSample *sample);
bool sensor_port_read_motion(MotionSample *sample);
bool sensor_port_read_optical(EnvironmentSample *sample);
bool control_port_set_indicator(bool on);
bool control_port_read_button(void);

#endif

