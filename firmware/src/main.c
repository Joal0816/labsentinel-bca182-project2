#include "stm32f4xx_hal.h"
#include "app_tasks.h"
#include "FreeRTOS.h"

static void clock_init_compile_profile(void)
{
    RCC_OscInitTypeDef oscillator = {0};
    RCC_ClkInitTypeDef clocks = {0};

    oscillator.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    oscillator.HSIState = RCC_HSI_ON;
    oscillator.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    oscillator.PLL.PLLState = RCC_PLL_NONE;
    configASSERT(HAL_RCC_OscConfig(&oscillator) == HAL_OK);

    clocks.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                       RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clocks.SYSCLKSource = RCC_SYSCLKSOURCE_HSI;
    clocks.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clocks.APB1CLKDivider = RCC_HCLK_DIV1;
    clocks.APB2CLKDivider = RCC_HCLK_DIV1;
    configASSERT(HAL_RCC_ClockConfig(&clocks, FLASH_LATENCY_0) == HAL_OK);
    SystemCoreClockUpdate();
}

int main(void)
{
    (void)HAL_Init();
    clock_init_compile_profile();
    labsentinel_tasks_start();
    for (;;) { __NOP(); }
}

