#!/usr/bin/env sh
set -eu
cc -std=c11 -Wall -Wextra -Werror -Ifirmware/include \
  firmware/src/control_logic.c firmware/src/motion_detector.c firmware/test/test_logic.c \
  -lm -o /tmp/labsentinel-host-tests
/tmp/labsentinel-host-tests
printf '%s\n' 'Host logic checks passed.'

