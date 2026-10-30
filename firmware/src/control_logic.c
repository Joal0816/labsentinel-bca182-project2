#include "control_logic.h"

#include <ctype.h>
#include <string.h>

#define COMMAND_PAYLOAD_MAX 128U

static void skip_space(const char **cursor, const char *end)
{
    while (*cursor < end && isspace((unsigned char)**cursor)) ++(*cursor);
}

static bool parse_string(const char **cursor, const char *end, char *output, size_t capacity)
{
    if (*cursor >= end || **cursor != '"' || capacity == 0U) return false;
    ++(*cursor);
    size_t length = 0U;
    while (*cursor < end && **cursor != '"') {
        const unsigned char character = (unsigned char)**cursor;
        if (character < 0x20U || character == '\\' || length + 1U >= capacity) return false;
        output[length++] = (char)character;
        ++(*cursor);
    }
    if (*cursor >= end || **cursor != '"') return false;
    ++(*cursor);
    output[length] = '\0';
    return length > 0U;
}

static bool valid_command_id(const char *value)
{
    const size_t length = strlen(value);
    if (length == 0U || length > 36U) return false;
    for (size_t index = 0U; index < length; ++index) {
        const unsigned char c = (unsigned char)value[index];
        if (!(isalnum(c) || c == '-' || c == '_')) return false;
    }
    return true;
}

CommandParseResult control_parse_command(const char *payload, size_t length, IndicatorCommand *out)
{
    if (payload == NULL || out == NULL) return COMMAND_PARSE_INVALID;
    if (length == 0U || length > COMMAND_PAYLOAD_MAX) return COMMAND_PARSE_OVERSIZE;

    const char *cursor = payload;
    const char *end = payload + length;
    char key[24] = {0};
    char value[40] = {0};
    bool have_id = false;
    bool have_command = false;
    IndicatorCommand parsed = {0};

    skip_space(&cursor, end);
    if (cursor >= end || *cursor++ != '{') return COMMAND_PARSE_INVALID;
    for (;;) {
        skip_space(&cursor, end);
        if (!parse_string(&cursor, end, key, sizeof(key))) return COMMAND_PARSE_INVALID;
        skip_space(&cursor, end);
        if (cursor >= end || *cursor++ != ':') return COMMAND_PARSE_INVALID;
        skip_space(&cursor, end);
        if (!parse_string(&cursor, end, value, sizeof(value))) return COMMAND_PARSE_INVALID;

        if (strcmp(key, "command_id") == 0 && !have_id) {
            if (!valid_command_id(value)) return COMMAND_PARSE_INVALID;
            (void)strncpy(parsed.command_id, value, sizeof(parsed.command_id) - 1U);
            have_id = true;
        } else if (strcmp(key, "command") == 0 && !have_command) {
            if (strcmp(value, "ON") == 0) parsed.requested_state = INDICATOR_ON;
            else if (strcmp(value, "OFF") == 0) parsed.requested_state = INDICATOR_OFF;
            else return COMMAND_PARSE_INVALID;
            have_command = true;
        } else {
            return COMMAND_PARSE_INVALID;
        }

        skip_space(&cursor, end);
        if (cursor >= end) return COMMAND_PARSE_INVALID;
        if (*cursor == '}') {
            ++cursor;
            break;
        }
        if (*cursor++ != ',') return COMMAND_PARSE_INVALID;
    }
    skip_space(&cursor, end);
    if (cursor != end || !have_id || !have_command) return COMMAND_PARSE_INVALID;
    *out = parsed;
    return COMMAND_PARSE_OK;
}

bool control_command_is_duplicate(const char *command_id, const char *last_command_id)
{
    return command_id != NULL && last_command_id != NULL && last_command_id[0] != '\0' &&
           strcmp(command_id, last_command_id) == 0;
}

IndicatorState control_button_toggle(IndicatorState actual_state)
{
    return actual_state == INDICATOR_ON ? INDICATOR_OFF : INDICATOR_ON;
}

