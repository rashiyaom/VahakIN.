#include "../vahakin_watch/HandlingAlarm.h"
#include <cassert>
#include <iostream>
int main(){HandlingAlarm h;uint32_t t=0;auto sample=[&](float x,float y,float z,float g){t+=20;h.sample(t,x,y,z,g,0,0);};for(int i=0;i<260;i++)sample(0,0,1,0);assert(h.calibrated&&!h.alarm);for(int i=0;i<500;i++)sample(.02,0,1.02,2);assert(!h.alarm);for(int i=0;i<60;i++)sample(.8,0,.6,40);assert(h.alarm);for(int i=0;i<300;i++)sample(.8,0,.6,0);assert(h.alarm);for(int i=0;i<200;i++)sample(0,0,1,0);assert(h.alarm);sample(.8,0,.6,40);for(int i=0;i<200;i++)sample(0,0,1,0);assert(h.alarm);for(int i=0;i<60;i++)sample(0,0,1,0);assert(!h.alarm);std::cout<<"PASS: calibration, vibration rejection, handling, orientation and uninterrupted 5-second clearing\n";}
