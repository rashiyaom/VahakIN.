#include "../hotspot_imu_demo/MotionDetector.h"
#include <cassert>
#include <iostream>
int main(){
 MotionDetector d;
 for(int i=0;i<250;i++)assert(!d.update(0,0,1,.3f,-.2f,.1f));
 assert(d.state==MotionDetector::Stationary);
 for(int i=0;i<500;i++)assert(!d.update((i%2?.015f:-.015f),0,1,.3f,-.2f,.1f));
 for(int i=0;i<20;i++)assert(!d.update(.4f,0,1,0,0,20)); // 400 ms bump.
 for(int i=0;i<300;i++)assert(!d.update(0,0,1,0,0,0));
 int events=0;for(int i=0;i<150;i++)events+=d.update(i%20<10?.3f:-.3f,0,1,0,0,18);
 assert(events==1&&d.state==MotionDetector::Moving&&d.qualifiedMs>=1500);
 for(int i=0;i<350;i++)assert(!d.update(0,0,1,0,0,0));
 assert(d.state==MotionDetector::Stationary);
 d.update(NAN,0,1,0,0,0);assert(d.state==MotionDetector::Fault);
 for(int i=0;i<100;i++)assert(!d.update(.5f,0,1,15,0,0));
 assert(d.state==MotionDetector::Calibrating);
 // Exercise different dashboard orientations and a full minute of bounded vibration.
 for(int axis=0;axis<3;axis++){
  MotionDetector mounted;float gravity[3]={0,0,0};gravity[axis]=1;
  for(int i=0;i<250;i++)assert(!mounted.update(gravity[0],gravity[1],gravity[2],0,0,0));
  for(int i=0;i<3000;i++){float noise=(i%2?.02f:-.02f);assert(!mounted.update(gravity[0]+noise,gravity[1]-noise,gravity[2],.5f,-.5f,.3f));}
  assert(mounted.state==MotionDetector::Stationary);
  // 1.4 seconds above threshold cannot qualify, regardless of orientation.
  for(int i=0;i<70;i++)assert(!mounted.update(gravity[0],gravity[1],gravity[2],0,0,18));
  for(int i=0;i<300;i++)assert(!mounted.update(gravity[0],gravity[1],gravity[2],0,0,0));
  int triggered=0;for(int i=0;i<300;i++)triggered+=mounted.update(gravity[0],gravity[1],gravity[2],0,0,18);
  assert(triggered==1); // Sustained movement is not emitted on every sample.
  for(int i=0;i<350;i++)mounted.update(gravity[0],gravity[1],gravity[2],0,0,0);
  triggered=0;for(int i=0;i<150;i++)triggered+=mounted.update(gravity[0],gravity[1],gravity[2],18,0,0);
  assert(triggered==1); // Quiet recovery permits the next genuine event.
  mounted.reset();assert(mounted.state==MotionDetector::Calibrating);
 }
 std::cout<<"PASS: calibration, small vibration, short bump, sustained movement, cooldown, sensor failure\n";
}
