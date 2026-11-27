#pragma once
#include <cmath>
#include <cstdint>
// 50 Hz input. No network, Arduino or clock dependency: exercised by host tests.
class MotionDetector {
 public:
  enum State { Calibrating, Stationary, Moving, Fault };
  State state=Calibrating;
  float accelerationG=0, rotationDps=0;
  uint32_t qualifiedMs=0;
  bool update(float ax,float ay,float az,float gx,float gy,float gz) {
    if(!std::isfinite(ax+ay+az+gx+gy+gz)) { reset(); state=Fault; return false; }
    if(state==Fault) reset();
    const float norm=std::sqrt(ax*ax+ay*ay+az*az);
    if(state==Calibrating) {
      // Restart calibration if touched. Estimate gyro bias and gravity only while still.
      const bool still=std::fabs(norm-1.f)<.06f && std::sqrt(gx*gx+gy*gy+gz*gz)<3.f &&
        (calibrationCount==0 || std::fabs(ax-lastX)+std::fabs(ay-lastY)+std::fabs(az-lastZ)<.035f);
      lastX=ax;lastY=ay;lastZ=az;
      if(!still) { calibrationCount=0;bx=by=bz=0;return false; }
      bx+=gx;by+=gy;bz+=gz;
      if(++calibrationCount>=calibrationTarget) {bx/=calibrationTarget;by/=calibrationTarget;bz/=calibrationTarget;gravityX=ax;gravityY=ay;gravityZ=az;state=Stationary;}
      return false;
    }
    // Track slow gravity changes. The gyro separately detects sustained rotation.
    gravityX+=.025f*(ax-gravityX);gravityY+=.025f*(ay-gravityY);gravityZ+=.025f*(az-gravityZ);
    const float dx=ax-gravityX,dy=ay-gravityY,dz=az-gravityZ;
    accelerationG=std::sqrt(dx*dx+dy*dy+dz*dz);
    rotationDps=std::sqrt((gx-bx)*(gx-bx)+(gy-by)*(gy-by)+(gz-bz)*(gz-bz));
    const bool active=accelerationG>=.12f || rotationDps>=12.f;
    activeCount-=window[index];window[index]=active;activeCount+=active;index=(index+1)%100;
    if(filled<100)filled++;
    if(active)quietSamples=0;else quietSamples++;
    bool event=false;
    if(filled==100 && activeCount>=75 && state!=Moving) {state=Moving;qualifiedMs=activeCount*20;event=true;}
    if(state==Moving && quietSamples>=250)state=Stationary;
    return event;
  }
  void reset(){state=Calibrating;calibrationCount=activeCount=index=filled=quietSamples=0;bx=by=bz=0;accelerationG=rotationDps=0;qualifiedMs=0;for(auto &v:window)v=false;}
  void setCalibrationSamples(uint16_t samples){calibrationTarget=samples<50?50:samples;reset();}
  // Preserve stationary calibration, but never count time asleep as motion evidence.
  void resumeAfterSleep(){
    if(state==Calibrating||state==Fault){reset();return;}
    state=Stationary;activeCount=index=filled=quietSamples=0;
    accelerationG=rotationDps=0;qualifiedMs=0;for(auto &v:window)v=false;
  }
 private:
  uint16_t calibrationTarget=250;
  bool window[100]={};int calibrationCount=0,activeCount=0,index=0,filled=0,quietSamples=0;
  float bx=0,by=0,bz=0,gravityX=0,gravityY=0,gravityZ=1,lastX=0,lastY=0,lastZ=1;
};
