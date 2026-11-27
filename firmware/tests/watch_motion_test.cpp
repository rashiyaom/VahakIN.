#include "../vahakin_watch/MotionWake.h"
#include "../libraries/VahakinDemo/src/MotionDetector.h"
#include <cassert>
#include <cstdio>
int main(){
 MotionWake w;w.start(0);assert(!w.expired(4999));assert(w.expired(5000));
 w.start(0);for(unsigned t=0;t<=5000;t+=20)w.sample(t,.015f*std::sin(t),.01f,1,0,0,0);assert(w.expired(5000));
 w.start(0);w.sample(0,0,0,1,0,0,0);assert(!w.sample(20,.3f,0,1,0,0,0));w.sample(40,0,0,1,0,0,0);assert(w.expired(5000));
 w.start(0);w.sample(0,0,0,1,0,0,0);for(unsigned t=20;t<=100;t+=20)w.sample(t,.4f,0,1,0,0,0);assert(!w.expired(5099));assert(w.expired(5100));
 w.start(0xfffffff0u);assert(!w.expired(0xfffffff0u+4999u));assert(w.expired(0xfffffff0u+5000u));
 w.start(0);w.sample(0,0,0,1,0,0,0);assert(!w.sample(500,.9f,0,1,0,0,0));assert(w.expired(5000));
 MotionDetector d;for(int i=0;i<250;i++)d.update(0,0,1,0,0,0);assert(d.state==MotionDetector::Stationary);
 MotionDetector watch;watch.setCalibrationSamples(100);for(int i=0;i<99;i++)watch.update(0,0,1,0,0,0);assert(watch.state==MotionDetector::Calibrating);watch.update(0,0,1,0,0,0);assert(watch.state==MotionDetector::Stationary);
 for(int i=0;i<100;i++)d.update(0,0,1,30,0,0);assert(d.state==MotionDetector::Moving);
 d.resumeAfterSleep();assert(d.state==MotionDetector::Stationary);assert(!d.update(0,0,1,30,0,0));assert(d.qualifiedMs==0);
 puts("Motion wake: timeout, noise, impulse, sustained motion, rollover, sample gap and resumed calibration passed.");
}
