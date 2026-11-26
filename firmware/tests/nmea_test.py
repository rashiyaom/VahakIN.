#!/usr/bin/env python3
"""Compile the actual runtime NMEA parser against a simulated clock (no Arduino hardware)."""
from pathlib import Path
import subprocess
import tempfile
source=(Path(__file__).resolve().parents[1]/'libraries/VahakinDemo/src/VahakinDemo.h').read_text()
parser=source[source.index('char nmea[128]'):source.index('void readGps()')]
prelude=r'''
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <ctime>
#include <string>
#include <iostream>
#include <sys/time.h>
int64_t clockMs=1795737600000LL;
uint32_t ticks=100;
int64_t epochMs(){return clockMs;}
bool clockReady(){return true;}
uint32_t millis(){return ticks;}
#define portENTER_CRITICAL(x) ((void)0)
#define portEXIT_CRITICAL(x) ((void)0)
struct {double lat,lng;float hdop;int satellites;int64_t gpsAt;uint32_t gpsMillis;}shared={};
'''
tests=r'''
void sentence(std::string value,bool corrupt=false){unsigned char sum=0;for(char c:value)sum^=c;snprintf(nmea,sizeof(nmea),"$%s*%02X",value.c_str(),corrupt?(sum^1):sum);parseNmea();}
void reset(){shared={};rmcAt=0;ggaQuality=0;clockMs=1795737600000LL;ticks=100;}
const char *rmc="GPRMC,000000.00,A,2218.0000,N,07048.0000,E,0.0,0.0,271126,,,A";
const char *gga="GPGGA,000000.00,2218.0000,N,07048.0000,E,1,08,1.2,10.0,M,0.0,M,,";
int main(){
 setenv("TZ","UTC0",1);tzset();
 for(bool reverse:{false,true}){reset();sentence(reverse?gga:rmc);sentence(reverse?rmc:gga);assert(shared.gpsAt==clockMs);assert(std::fabs(shared.lat-22.3)<.000001);assert(std::fabs(shared.lng-70.8)<.000001);assert(shared.satellites==8);}
 reset();sentence(rmc,true);sentence(gga);assert(!shared.gpsAt);
 reset();sentence(rmc);ticks+=3000;sentence(gga);assert(!shared.gpsAt);
 reset();sentence(gga);sentence("GPRMC,000000.00,V,,,,,,,271126,,,N");assert(!shared.gpsAt);
 reset();sentence(gga);sentence("GPRMC,000001.00,A,2218.0000,N,07048.0000,E,0,0,271126,,,A");assert(!shared.gpsAt);
 reset();sentence(gga);sentence("GPRMC,000000.00,A,garbage,N,07048.0000,E,0,0,271126,,,A");assert(!shared.gpsAt);
 reset();sentence(rmc);sentence("GPGGA,000000.00,2218.0000,N,07048.0000,E,1,08,NaN,10,M,0,M,,");assert(!shared.gpsAt);
 std::cout<<"PASS: actual NMEA parser, both sentence orders, checksum, stale/no fix, mismatched epochs and invalid numbers\n";
}
'''
with tempfile.TemporaryDirectory(prefix='ig-nmea-') as directory:
    path=Path(directory)/'test.cpp';path.write_text(prelude+parser+tests)
    binary=str(Path(directory)/'test')
    subprocess.run(['c++','-std=c++17','-fsanitize=address,undefined',str(path),'-o',binary],check=True)
    subprocess.run([binary],check=True)
