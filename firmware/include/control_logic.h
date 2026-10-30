#ifndef LABSENTINEL_CONTROL_LOGIC_H
#define LABSENTINEL_CONTROL_LOGIC_H

#include <stdbool.h>
#include <stddef.h>

typedef enum {
    INDICATOR_UNKNOWN = 0,
    INDICATOR_OFF,
    INDICATOR_ON
} IndicatorState;

typedef struct {
    char command_id[37];
    IndicatorState requested_state;
} IndicatorCommand;

typedef enum {
    COMMAND_PARSE_OK = 0,
    COMMAND_PARSE_INVALID = -1,
    COMMAND_PARSE_OVERSIZE = -2
} CommandParseResult;

CommandParseResult control_parse_command(const char *payload, size_t length, IndicatorCommand *out);
bool control_command_is_duplicate(const char *command_id, const char *last_command_id);
IndicatorState control_button_toggle(IndicatorState actual_state);

#endif

