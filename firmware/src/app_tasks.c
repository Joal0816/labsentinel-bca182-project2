#include "app_tasks.h"

#include "FreeRTOS.h"
#include "control_logic.h"
#include "queue.h"
#include "semphr.h"
#include "sensor_port.h"
#include "stm32f4xx_hal.h"
#include "task.h"

#include <stdio.h>
#include <string.h>

typedef enum {
    CONTROL_SOURCE_REMOTE = 0,
    CONTROL_SOURCE_LOCAL
} ControlSource;

typedef struct {
    IndicatorState requested_state;
    ControlSource source;
    char command_id[37];
} ControlEvent;

typedef struct {
    uint32_t motion_heartbeats;
    uint32_t environment_heartbeats;
    uint32_t control_heartbeats;
    uint32_t communication_heartbeats;
    uint32_t sensor_faults;
    uint32_t command_rejections;
    uint32_t minimum_free_heap;
    UBaseType_t motion_stack_words;
    UBaseType_t environment_stack_words;
    UBaseType_t control_stack_words;
    UBaseType_t communication_stack_words;
    uint8_t hardware_unverified;
} MonitorDiagnostics;

static QueueHandle_t control_queue;
static QueueHandle_t latest_environment;
static QueueHandle_t latest_motion;
static TaskHandle_t motion_handle;
static TaskHandle_t environment_handle;
static TaskHandle_t control_handle;
static TaskHandle_t communication_handle;
static TaskHandle_t health_handle;
static volatile MonitorDiagnostics diagnostics = {.hardware_unverified = 1U};
static IndicatorState actual_indicator = INDICATOR_OFF;
static char last_command_id[37];

static void motion_task(void *argument)
{
    (void)argument;
    TickType_t wake = xTaskGetTickCount();
    MotionSample sample = {0};
    for (;;) {
        if (sensor_port_read_motion(&sample) && sample.valid) {
            (void)xQueueOverwrite(latest_motion, &sample);
        } else {
            diagnostics.sensor_faults++;
        }
        diagnostics.motion_heartbeats++;
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(20U));
    }
}

static void environment_task(void *argument)
{
    (void)argument;
    TickType_t wake = xTaskGetTickCount();
    uint32_t sequence = 0U;
    EnvironmentSample sample = {0};
    for (;;) {
        sample.sample_sequence = sequence++;
        sample.uptime_ms = (uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS);
        const bool environment_ok = sensor_port_read_environment(&sample);
        const bool optical_ok = sensor_port_read_optical(&sample);
        sample.environment_valid = environment_ok;
        sample.optical_valid = optical_ok;
        if (environment_ok || optical_ok) {
            (void)xQueueOverwrite(latest_environment, &sample);
        } else {
            diagnostics.sensor_faults++;
        }
        diagnostics.environment_heartbeats++;
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(2000U));
    }
}

static void control_task(void *argument)
{
    (void)argument;
    ControlEvent event;
    TickType_t last_button_tick = 0U;
    for (;;) {
        const BaseType_t has_remote = xQueueReceive(control_queue, &event, pdMS_TO_TICKS(20U));
        const TickType_t now = xTaskGetTickCount();
        const bool button_pressed = control_port_read_button();

        if (has_remote == pdPASS) {
            if (event.source == CONTROL_SOURCE_REMOTE) {
                if (control_command_is_duplicate(event.command_id, last_command_id)) {
                    diagnostics.command_rejections++;
                } else {
                    const bool requested_on = event.requested_state == INDICATOR_ON;
                    if (control_port_set_indicator(requested_on)) {
                        actual_indicator = event.requested_state;
                        (void)strncpy(last_command_id, event.command_id, sizeof(last_command_id) - 1U);
                    } else {
                        diagnostics.command_rejections++;
                    }
                }
            }
        }

        if (button_pressed && (uint32_t)(now - last_button_tick) >= pdMS_TO_TICKS(30U)) {
            last_button_tick = now;
            const IndicatorState next = control_button_toggle(actual_indicator);
            if (control_port_set_indicator(next == INDICATOR_ON)) {
                actual_indicator = next;
            }
        }
        diagnostics.control_heartbeats++;
    }
}

static void communication_task(void *argument)
{
    (void)argument;
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        /* Wi-Fi and MQTT adapters remain offline until module and pin mapping are verified. */
        diagnostics.communication_heartbeats++;
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(5000U));
    }
}

static void health_task(void *argument)
{
    (void)argument;
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        diagnostics.minimum_free_heap = xPortGetMinimumEverFreeHeapSize();
        diagnostics.motion_stack_words = uxTaskGetStackHighWaterMark(motion_handle);
        diagnostics.environment_stack_words = uxTaskGetStackHighWaterMark(environment_handle);
        diagnostics.control_stack_words = uxTaskGetStackHighWaterMark(control_handle);
        diagnostics.communication_stack_words = uxTaskGetStackHighWaterMark(communication_handle);
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(1000U));
    }
}

void vApplicationMallocFailedHook(void)
{
    taskDISABLE_INTERRUPTS();
    for (;;) { __NOP(); }
}

void vApplicationStackOverflowHook(TaskHandle_t task, char *name)
{
    (void)task;
    (void)name;
    taskDISABLE_INTERRUPTS();
    for (;;) { __NOP(); }
}

void labsentinel_tasks_start(void)
{
    control_queue = xQueueCreate(8U, sizeof(ControlEvent));
    latest_environment = xQueueCreate(1U, sizeof(EnvironmentSample));
    latest_motion = xQueueCreate(1U, sizeof(MotionSample));
    configASSERT(control_queue != NULL && latest_environment != NULL && latest_motion != NULL);
    vQueueAddToRegistry(control_queue, "control-events");
    vQueueAddToRegistry(latest_environment, "environment-latest");
    vQueueAddToRegistry(latest_motion, "motion-latest");

    configASSERT(xTaskCreate(motion_task, "Motion", 384U, NULL, 5U, &motion_handle) == pdPASS);
    configASSERT(xTaskCreate(environment_task, "Environment", 384U, NULL, 3U, &environment_handle) == pdPASS);
    configASSERT(xTaskCreate(control_task, "Control", 384U, NULL, 4U, &control_handle) == pdPASS);
    configASSERT(xTaskCreate(communication_task, "Communications", 512U, NULL, 2U,
                             &communication_handle) == pdPASS);
    configASSERT(xTaskCreate(health_task, "Health", 256U, NULL, 1U, &health_handle) == pdPASS);
    vTaskStartScheduler();
    for (;;) { __NOP(); }
}

LabsentinelEnqueueResult labsentinel_enqueue_remote_command(const char *payload, size_t length)
{
    if (control_queue == NULL) return LABSENTINEL_ENQUEUE_UNAVAILABLE;
    IndicatorCommand parsed;
    if (control_parse_command(payload, length, &parsed) != COMMAND_PARSE_OK) {
        diagnostics.command_rejections++;
        return LABSENTINEL_ENQUEUE_INVALID;
    }

    ControlEvent event = {
        .requested_state = parsed.requested_state,
        .source = CONTROL_SOURCE_REMOTE,
    };
    (void)strncpy(event.command_id, parsed.command_id, sizeof(event.command_id) - 1U);
    if (xQueueSend(control_queue, &event, 0U) != pdPASS) {
        diagnostics.command_rejections++;
        return LABSENTINEL_ENQUEUE_FULL;
    }
    return LABSENTINEL_ENQUEUE_OK;
}

