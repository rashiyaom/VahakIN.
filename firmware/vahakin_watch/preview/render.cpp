#include "../WatchUI.h"
#include <fstream>
#include <string>
static uint16_t frame[410*502],buf[410*50];
static void flush(lv_display_t*d,const lv_area_t*a,uint8_t*raw){
 auto*p=(uint16_t*)raw;
 for(int y=a->y1;y<=a->y2;y++)for(int x=a->x1;x<=a->x2;x++)frame[y*410+x]=*p++;
 lv_display_flush_ready(d);
}
int main(int argc,char**argv){
 lv_init();auto*d=lv_display_create(410,502);lv_display_set_color_format(d,LV_COLOR_FORMAT_RGB565);
 lv_display_set_buffers(d,buf,nullptr,sizeof(buf),LV_DISPLAY_RENDER_MODE_PARTIAL);lv_display_set_flush_cb(d,flush);
 WatchUI::Readings r;r.clock="09:41";r.imu=true;r.battery=86;r.az=1;
 for(int page=0;page<WatchUI::COUNT;page++){
  WatchUI::data=r;WatchUI::show(WatchUI::Page(page));
  for(int i=0;i<40;i++){r.ax=.04f*sinf(i*.5f);r.ay=.03f*cosf(i*.7f);WatchUI::update(r);}
  lv_refr_now(d);
  std::ofstream f(std::string(argc>1?argv[1]:".")+"/screen-"+std::to_string(page)+".ppm",std::ios::binary);
  f<<"P6\n410 502\n255\n";for(auto v:frame){char b[]={char(((v>>11)&31)*255/31),char(((v>>5)&63)*255/63),char((v&31)*255/31)};f.write(b,3);}
 }
}
