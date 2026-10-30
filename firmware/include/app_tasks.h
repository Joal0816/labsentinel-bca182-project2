#ifndef LABSENTINEL_APP_TASKS_H
#define LABSENTINEL_APP_TASKS_H

#include "control_logic.h"
#include <stddef.h>

typedef enum {
    LABSENTINEL_ENQUEUE_OK = 0,
    LABSENTINEL_ENQUEUE_INVALID = -1,
    LABSENTINEL_ENQUEUE_UNAVAILABLE = -2,
    LABSENTINEL_ENQUEUE_FULL = -3
} LabsentinelEnqueueResult;

void labsentinel_tasks_start(void);
LabsentinelEnqueueResult labsentinel_enqueue_remote_command(const char *payload, size_t length);

#endif

