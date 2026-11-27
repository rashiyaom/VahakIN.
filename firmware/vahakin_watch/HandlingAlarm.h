#pragma once
#include <cmath>
#include <cstdint>
struct HandlingAlarm {
 float bx=0,by=0,bz=1;bool calibrated=false,alarm=false;uint32_t last=0,quiet=0,suspect=0;float sx=0,sy=0,sz=0;unsigned count=0;
 void sample(uint32_t now,float ax,float ay,float az,float gx,float gy,float gz){
  uint32_t dt=last?now-last:20;last=now;if(dt>100){quiet=0;suspect=0;count=0;sx=sy=sz=0;return;}
  float norm=std::sqrt(ax*ax+ay*ay+az*az),rotation=std::sqrt(gx*gx+gy*gy+gz*gz);bool still=std::fabs(norm-1)<.06f&&rotation<3;
  if(!calibrated){if(!still){quiet=0;count=0;sx=sy=sz=0;return;}quiet+=dt;sx+=ax;sy+=ay;sz+=az;count++;if(quiet>=5000){float n=std::sqrt(sx*sx+sy*sy+sz*sz);if(n>.1f){bx=sx/n;by=sy/n;bz=sz/n;calibrated=true;}quiet=0;}return;}
  float cosine=norm>.1f?(ax*bx+ay*by+az*bz)/norm:0;cosine=fmaxf(-1,fminf(1,cosine));float tilt=acosf(cosine)*57.29578f;
  bool handling=(tilt>25&&(rotation>20||std::fabs(norm-1)>.18f))||tilt>55||norm<.35f;
  suspect=handling?suspect+dt:0;if(suspect>=800)alarm=true;
  if(alarm){if(still&&tilt<12){quiet+=dt;if(quiet>=5000){alarm=false;quiet=0;suspect=0;}}else quiet=0;}
 }
};
