"""Compile the STM32CubeF4 FreeRTOS kernel and Cortex-M4F port."""

from pathlib import Path

Import("env")  # noqa: F821 - injected by PlatformIO/SCons

framework = Path(env.PioPlatform().get_package_dir("framework-stm32cubef4"))
kernel = framework / "Middlewares/Third_Party/FreeRTOS/Source"
port = kernel / "portable/GCC/ARM_CM4F"
if not (port / "port.c").is_file():
    raise RuntimeError("STM32CubeF4 package does not contain the FreeRTOS ARM_CM4F port")

env.Append(CPPPATH=[str(kernel / "include"), str(port)])
env.Append(LINKFLAGS=["-mfpu=fpv4-sp-d16", "-mfloat-abi=hard"])
env.Append(ASFLAGS=["-mfpu=fpv4-sp-d16", "-mfloat-abi=hard"])
env.BuildSources(
    "$BUILD_DIR/FreeRTOS",
    str(kernel),
    src_filter=(
        "-<*> +<tasks.c> +<queue.c> +<list.c> "
        "+<portable/GCC/ARM_CM4F/port.c> +<portable/MemMang/heap_4.c>"
    ),
)

