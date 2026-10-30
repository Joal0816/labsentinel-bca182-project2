#include "control_logic.h"
#include "motion_detector.h"

#include <assert.h>
#include <math.h>
#include <string.h>

static void test_command_parser(void)
{
    IndicatorCommand parsed;
    const char *valid = "{\"command_id\":\"trial-01\",\"command\":\"ON\"}";
    assert(control_parse_command(valid, strlen(valid), &parsed) == COMMAND_PARSE_OK);
    assert(strcmp(parsed.command_id, "trial-01") == 0);
    assert(parsed.requested_state == INDICATOR_ON);
    const char *invalid_state = "{\"command\":\"BLINK\",\"command_id\":\"x\"}";
    const char *extra = "{\"command_id\":\"x\",\"command\":\"ON\",\"extra\":\"y\"}";
    assert(control_parse_command(invalid_state, strlen(invalid_state), &parsed) == COMMAND_PARSE_INVALID);
    assert(control_parse_command(extra, strlen(extra), &parsed) == COMMAND_PARSE_INVALID);
}

static void test_duplicate_and_local_toggle(void)
{
    assert(control_command_is_duplicate("cmd-1", "cmd-1"));
    assert(!control_command_is_duplicate("cmd-2", "cmd-1"));
    assert(control_button_toggle(INDICATOR_OFF) == INDICATOR_ON);
    assert(control_button_toggle(INDICATOR_ON) == INDICATOR_OFF);
}

static void test_motion_threshold_and_wraparound(void)
{
    MotionDetector detector;
    motion_detector_init(&detector, 0.2f, 15.0f, 200U, 500U);
    motion_detector_set_baseline(&detector, 0.0f, 179.0f);
    assert(!motion_detector_update(&detector, 0.0f, -179.0f, 0.05f, 100U));
    assert(!motion_detector_update(&detector, 0.0f, -179.0f, 0.25f, 200U));
    assert(motion_detector_update(&detector, 0.0f, -179.0f, 0.25f, 400U));
    assert(motion_detector_update(&detector, 0.0f, -179.0f, 0.0f, 500U));
    assert(motion_detector_update(&detector, 0.0f, -179.0f, 0.0f, 999U));
    assert(!motion_detector_update(&detector, 0.0f, -179.0f, 0.0f, 1000U));
    assert(!motion_detector_update(&detector, NAN, 0.0f, 0.0f, 1200U));
}

int main(void)
{
    test_command_parser();
    test_duplicate_and_local_toggle();
    test_motion_threshold_and_wraparound();
    return 0;
}

