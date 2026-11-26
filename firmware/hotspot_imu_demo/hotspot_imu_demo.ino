// See README.md. Compile with --libraries firmware/libraries. Do not flash until authorized.
#define VAHAKIN_PLUS 0
#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.example.h"
#endif
#include <VahakinDemo.h>
