#include "sensor_port.h"

#include <stddef.h>

bool sensor_port_read_environment(EnvironmentSample *sample)
{
    (void)sample;
    return false;
}

bool sensor_port_read_motion(MotionSample *sample)
{
    (void)sample;
    return false;
}

bool sensor_port_read_optical(EnvironmentSample *sample)
{
    (void)sample;
    return false;
}

bool control_port_set_indicator(bool on)
{
    (void)on;
    return false;
}

bool control_port_read_button(void)
{
    return false;
}

