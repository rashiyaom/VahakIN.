#!/bin/sh
set -eu
SKETCH_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BOARD_LIBS=${WAVESHARE_LIBRARIES:-/tmp/waveshare-watch/examples/arduino/libraries}
CLI_CONFIG=${WATCH_ARDUINO_CONFIG:-/tmp/vahakin-watch-toolchain/arduino-cli.yaml}
# Reuse provisioning; no secret values are logged.
if [ -f "$SKETCH_DIR/../plus_watch_demo/config.local.h" ]; then
  cp "$SKETCH_DIR/../plus_watch_demo/config.local.h" "$SKETCH_DIR/config.local.h"
  chmod 600 "$SKETCH_DIR/config.local.h"
fi
arduino-cli --config-file "$CLI_CONFIG" compile \
 --fqbn 'esp32:esp32:esp32s3:FlashSize=32M,PSRAM=opi,PartitionScheme=huge_app,CDCOnBoot=cdc' \
 --libraries "$BOARD_LIBS" --libraries "$SKETCH_DIR/../libraries" \
 --build-property "compiler.cpp.extra_flags=-DLV_CONF_INCLUDE_SIMPLE -I$SKETCH_DIR" \
 --build-property "compiler.c.extra_flags=-DLV_CONF_INCLUDE_SIMPLE -I$SKETCH_DIR" \
 --build-path "$SKETCH_DIR/build" "$SKETCH_DIR"
