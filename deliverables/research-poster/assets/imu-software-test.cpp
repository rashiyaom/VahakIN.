#include "../../../firmware/libraries/VahakinDemo/src/MotionDetector.h"
#include <cstdio>
int main(){MotionDetector d;puts("time_s,ax_g,ay_g,az_g,gyro_z_dps,dynamic_g,rotation_dps,state,event");for(int i=0;i<1300;i++){float t=i*.02f,ax=.012f*std::sin(i*.8f),ay=.008f*std::cos(i*.6f),az=1,gz=0;
 if(t>=7&&t<7.4){ax=.32f;gz=18;}
 if(t>=12&&t<16){ax=.30f*std::sin((t-12)*8);gz=18;}
 bool e=d.update(ax,ay,az,0,0,gz);printf("%.2f,%.5f,%.5f,%.5f,%.4f,%.5f,%.5f,%d,%d\n",t,ax,ay,az,gz,d.accelerationG,d.rotationDps,int(d.state),e);}}
