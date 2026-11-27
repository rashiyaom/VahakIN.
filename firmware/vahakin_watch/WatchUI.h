#pragma once
#include <lvgl.h>
#include <cstdio>
#include <cmath>
#include <cstdint>
#include "VenueMap.h"

// Presentation fixtures stay local. This UI never submits telemetry or declarations.
namespace WatchUI {
constexpr uint32_t kBlack=0x000000, kCard=0x151a18, kLime=0xd4f590, kWhite=0xf5f7f2,
 kMuted=0x94a39a, kTeal=0x6bd6b9, kBlue=0x80bfff, kAmber=0xf5be78;
enum Page { HOME, APPS, MAP, MOTION, VEHICLE, ACTIVITY, POWER, COUNT };
struct Readings { float ax=0,ay=0,az=0,gx=0,gy=0,gz=0; int battery=-1; bool imu=false,charging=false; const char *clock="--:--"; };
static Readings data;
static Page page=HOME;
static lv_obj_t *root,*value=nullptr,*detail=nullptr,*plot=nullptr,*status=nullptr,*clockLabel=nullptr,*batteryLabel=nullptr,*mapView=nullptr;
static lv_chart_series_t *series[3];
static lv_obj_t *powerArc=nullptr;
static lv_obj_t *placeLabel=nullptr,*coordsLabel=nullptr,*plateLabel=nullptr,*declarationLabel=nullptr;
static void (*pageChanged)(int)=nullptr;
static void (*brightnessChanged)(int)=nullptr;
static int brightness=70;
static int requested=-1;
static lv_color_t color(uint32_t c){return lv_color_hex(c);}
static lv_obj_t *box(lv_obj_t *p,int x,int y,int w,int h,uint32_t c=kCard,int radius=26){
 auto *o=lv_obj_create(p);lv_obj_remove_style_all(o);lv_obj_set_pos(o,x,y);lv_obj_set_size(o,w,h);
 lv_obj_set_style_bg_color(o,color(c),0);lv_obj_set_style_bg_opa(o,255,0);lv_obj_set_style_radius(o,radius,0);
 lv_obj_remove_flag(o,LV_OBJ_FLAG_SCROLLABLE);return o;
}
static lv_obj_t *text(lv_obj_t*p,const char*s,int x,int y,int w,const lv_font_t*f=&lv_font_montserrat_20,uint32_t c=kWhite){
 auto*o=lv_label_create(p);lv_label_set_text(o,s);lv_obj_set_pos(o,x,y);lv_obj_set_width(o,w);
 lv_obj_set_style_text_font(o,f,0);lv_obj_set_style_text_color(o,color(c),0);return o;
}
static void center(lv_obj_t*o){lv_obj_set_style_text_align(o,LV_TEXT_ALIGN_CENTER,0);}
static void nav(lv_event_t*e){requested=int(intptr_t(lv_event_get_user_data(e)));}
static lv_obj_t *button(lv_obj_t*p,const char*s,int x,int y,int w,int h,int target,uint32_t bg=kCard,uint32_t fg=kWhite){
 auto*o=box(p,x,y,w,h,bg,h/2);lv_obj_add_flag(o,LV_OBJ_FLAG_CLICKABLE);
 lv_obj_add_event_cb(o,nav,LV_EVENT_CLICKED,reinterpret_cast<void*>(intptr_t(target)));
 auto*l=text(o,s,0,0,w,&lv_font_montserrat_20,fg);center(l);lv_obj_align(l,LV_ALIGN_CENTER,0,0);
 return o;
}
static void line(lv_obj_t*p,int x,int y,int w,int h,uint32_t c){box(p,x,y,w,h,c,2);}
static void header(const char*title,const char*tag){
 button(root,LV_SYMBOL_LEFT,22,22,48,48,APPS);
 text(root,title,82,29,235,&lv_font_montserrat_24);
 text(root,tag,30,84,350,&lv_font_montserrat_14,kMuted);
}
static void footer(int prev,int next){
 button(root,LV_SYMBOL_LEFT,26,435,60,46,prev);
 button(root,LV_SYMBOL_HOME,170,435,70,46,HOME);
 button(root,LV_SYMBOL_RIGHT,324,435,60,46,next);
}
static lv_obj_t *ring(lv_obj_t*p,int x,int y,int size,int progress,uint32_t c){
 auto*a=lv_arc_create(p);lv_obj_set_pos(a,x,y);lv_obj_set_size(a,size,size);
 lv_arc_set_rotation(a,140);lv_arc_set_bg_angles(a,0,260);lv_arc_set_value(a,progress);
 lv_obj_set_style_arc_width(a,9,LV_PART_MAIN);lv_obj_set_style_arc_color(a,color(0x243129),LV_PART_MAIN);
 lv_obj_set_style_arc_width(a,9,LV_PART_INDICATOR);lv_obj_set_style_arc_color(a,color(c),LV_PART_INDICATOR);
 lv_obj_remove_style(a,nullptr,LV_PART_KNOB);lv_obj_remove_flag(a,LV_OBJ_FLAG_CLICKABLE);
 return a;
}
static void show(Page p);
static void home(){
 text(root,"VahakIN.",30,25,240,&lv_font_montserrat_24,kLime);
 text(root,"PLUS",300,31,70,&lv_font_montserrat_14,kMuted);
 clockLabel=text(root,data.clock,25,67,360,&lv_font_montserrat_48);center(clockLabel);
 auto*sub=text(root,"A quieter kind of confidence.",20,126,370,&lv_font_montserrat_16,kMuted);center(sub);
 ring(root,107,159,196,100,kLime);
 center(text(root,LV_SYMBOL_OK,155,192,100,&lv_font_montserrat_32,kLime));
 center(text(root,"Guard",120,237,170,&lv_font_montserrat_32));
 center(text(root,"AT A GLANCE",112,280,186,&lv_font_montserrat_14,kMuted));
 auto*l=button(root,"",26,353,174,65,MAP);text(l,LV_SYMBOL_GPS "  Location",12,11,152,&lv_font_montserrat_16,kBlue);text(l,"Gandhinagar",12,35,150,&lv_font_montserrat_16);
 auto*r=button(root,"",210,353,174,65,MOTION);text(r,"IMU  /  6 AXIS",12,11,152,&lv_font_montserrat_14,kTeal);status=text(r,data.imu?"Sensing":"Unavailable",12,35,150,&lv_font_montserrat_16);
 button(root,"Explore  " LV_SYMBOL_RIGHT,85,435,240,46,APPS,kLime,kBlack);
}
static void apps(){
 text(root,"Your VahakIN",30,25,350,&lv_font_montserrat_28);
 text(root,"EVERY DETAIL. ONE GLANCE.",30,67,350,&lv_font_montserrat_14,kMuted);
 const char*names[]={"Location","Motion","Vehicle","Activity","Power","Watch face"};
 const char*icons[]={LV_SYMBOL_GPS,LV_SYMBOL_SHUFFLE,LV_SYMBOL_DRIVE,LV_SYMBOL_BELL,LV_SYMBOL_CHARGE,LV_SYMBOL_HOME};
 uint32_t colors[]={kBlue,kTeal,kLime,kAmber,kLime,kWhite}; int targets[]={MAP,MOTION,VEHICLE,ACTIVITY,POWER,HOME};
 for(int i=0;i<6;i++){int x=26+(i%2)*184,y=106+(i/2)*105;auto*c=button(root,"",x,y,174,95,targets[i]);
  text(c,icons[i],17,13,130,&lv_font_montserrat_28,colors[i]);text(c,names[i],17,57,145,&lv_font_montserrat_20);}
 button(root,LV_SYMBOL_HOME,170,435,70,46,HOME);
}
static lv_obj_t *mapDot=nullptr;
static void recenter(lv_event_t*){lv_obj_scroll_to(mapView,VenueMap::x(VenueMap::LNG)-205,VenueMap::y(VenueMap::LAT)-225,LV_ANIM_ON);}
static void map(){
 mapView=box(root,0,0,410,502,0x18251f,0);lv_obj_add_flag(mapView,LV_OBJ_FLAG_SCROLLABLE);
 lv_obj_set_scroll_dir(mapView,LV_DIR_ALL);lv_obj_set_scrollbar_mode(mapView,LV_SCROLLBAR_MODE_OFF);
 auto*m=box(mapView,0,0,VenueMap::W,VenueMap::H,0x18251f,0);lv_obj_remove_flag(m,LV_OBJ_FLAG_CLICKABLE);
 for(const auto&p:VenueMap::paths){auto*l=lv_line_create(m);lv_line_set_points(l,p.points,p.count);lv_obj_set_style_line_width(l,p.width,0);lv_obj_set_style_line_color(l,color(p.color),0);lv_obj_set_style_line_rounded(l,true,0);}
 auto label=[&](const char*s,double lat,double lng,int width){text(m,s,VenueMap::x(lng),VenueMap::y(lat),width,&lv_font_montserrat_16,0xc6d3bb);};
 label("Dandi Kutir",23.2328,72.6304,170);label("Mahatma Mandir",23.23185,72.6330,220);
 label("Sector 13",23.2292,72.6361,180);label("Sector 14",23.2365,72.6324,180);
 label("Sector 15",23.2347,72.6382,180);label("Station Road",23.2337,72.6319,200);
 label("KH Road",23.2300,72.6383,180);
 int x=VenueMap::x(VenueMap::LNG),y=VenueMap::y(VenueMap::LAT);
 auto*f=box(m,x-90,y-90,180,180,0x41673b,90);lv_obj_set_style_bg_opa(f,40,0);lv_obj_set_style_border_color(f,color(kLime),0);lv_obj_set_style_border_width(f,2,0);
 mapDot=box(m,x-17,y-17,34,34,kBlue,17);lv_obj_set_style_border_width(mapDot,5,0);lv_obj_set_style_border_color(mapDot,color(kWhite),0);
 lv_obj_update_layout(mapView);lv_obj_scroll_to(mapView,x-205,y-225,LV_ANIM_OFF);
 button(root,LV_SYMBOL_LEFT,24,24,50,50,APPS,0x101713);
 auto*title=box(root,86,24,220,50,0x101713,25);center(text(title,"Location",0,12,220,&lv_font_montserrat_20));
 auto*b=box(root,334,24,50,50,0x101713,25);center(text(b,"N",0,12,50,&lv_font_montserrat_20,kLime));
 auto*r=box(root,328,276,56,56,0x101713,28);center(text(r,LV_SYMBOL_GPS,0,15,56,&lv_font_montserrat_24,kBlue));lv_obj_add_flag(r,LV_OBJ_FLAG_CLICKABLE);lv_obj_add_event_cb(r,recenter,LV_EVENT_CLICKED,nullptr);
 text(root,"(c) OpenStreetMap",26,339,300,&lv_font_montserrat_14,kWhite);
 auto*c=box(root,20,363,370,119,0x101713,30);
 text(c,"EXHIBITION CENTRE",20,16,330,&lv_font_montserrat_14,kLime);
 placeLabel=text(c,"Gate 7 / Auditorium",20,42,330,&lv_font_montserrat_24);
 coordsLabel=text(c,"Mahatma Mandir / Gandhinagar",20,80,330,&lv_font_montserrat_14,kMuted);
}
static void motion(){
 header("Motion studio","QMI8658  /  SIX-AXIS IMU");
 value=text(root,"0.00 g",28,112,352,&lv_font_montserrat_48,kTeal);
 detail=text(root,"Acceleration magnitude",30,172,350,&lv_font_montserrat_16,kMuted);
 plot=lv_chart_create(root);lv_obj_set_pos(plot,26,209);lv_obj_set_size(plot,358,112);
 lv_obj_set_style_bg_color(plot,color(kCard),0);lv_obj_set_style_border_width(plot,0,0);lv_obj_set_style_radius(plot,22,0);
 lv_obj_set_style_line_color(plot,color(0x303c34),LV_PART_MAIN);lv_obj_set_style_size(plot,0,0,LV_PART_INDICATOR);
 lv_chart_set_range(plot,LV_CHART_AXIS_PRIMARY_Y,-2000,2000);lv_chart_set_point_count(plot,40);
 lv_chart_set_div_line_count(plot,3,0);lv_obj_set_style_line_width(plot,2,LV_PART_ITEMS);
 uint32_t cs[]={kTeal,kBlue,kAmber};for(int i=0;i<3;i++)series[i]=lv_chart_add_series(plot,color(cs[i]),LV_CHART_AXIS_PRIMARY_Y);
 auto*c=box(root,26,336,358,79);status=text(c,"X  --     Y  --     Z  --",15,13,330,&lv_font_montserrat_16);
 text(c,"MOVE TO WAKE  /  REST TO SLEEP",15,47,330,&lv_font_montserrat_14,kTeal);
 footer(MAP,VEHICLE);
}
static void vehicle(){
 header("Vehicle","VAHAKIN PLUS  /  NON-USE");
 auto*c=box(root,26,113,358,144);
 text(c,LV_SYMBOL_DRIVE,22,17,80,&lv_font_montserrat_32,kLime);
 plateLabel=text(c,"GJ 03 AB 2026",22,62,320,&lv_font_montserrat_28);
 text(c,"Rajkot  /  Private motor car",22,107,320,&lv_font_montserrat_16,kMuted);
 text(root,"Declaration",30,282,230,&lv_font_montserrat_20);declarationLabel=text(root,"Non-use",255,282,130,&lv_font_montserrat_20,kLime);
 line(root,30,318,350,1,0x303a32);
 text(root,"Parking radius",30,336,240,&lv_font_montserrat_20);text(root,"150 m",280,336,100,&lv_font_montserrat_20);
 text(root,"Every signal, in one place.",30,386,350,&lv_font_montserrat_16,kMuted);
 footer(MOTION,ACTIVITY);
}
static void activity(){
 header("Activity","YOUR VEHICLE, THROUGH THE DAY");
 const char*t[]={"Parking zone","Motion recorded","Device connected"};
 const char*d[]={"Vehicle inside selected area","A movement event was captured","Monitoring session opened"};
 const char*times[]={"09:41","09:36","09:30"};
 uint32_t cs[]={kLime,kAmber,kBlue};
 for(int i=0;i<3;i++){auto*c=box(root,26,112+i*103,358,91);box(c,16,22,8,8,cs[i],4);text(c,t[i],38,14,245,&lv_font_montserrat_20);text(c,times[i],277,18,70,&lv_font_montserrat_14,kMuted);text(c,d[i],38,49,300,&lv_font_montserrat_14,kMuted);}
 footer(VEHICLE,POWER);
}
static void brightnessEvent(lv_event_t*e){brightness=lv_slider_get_value((lv_obj_t*)lv_event_get_target(e));if(brightnessChanged)brightnessChanged(brightness);}
static void power(){
 header("Power","DESIGNED TO REST");
 powerArc=ring(root,34,111,156,data.battery<0?0:data.battery,kLime);
 value=text(root,"--",64,164,100,&lv_font_montserrat_32,kLime);center(value);
 text(root,"Motion wake",210,143,180,&lv_font_montserrat_20);
 text(root,"Always ready.\nOnly on when\nyou move.",210,179,170,&lv_font_montserrat_16,kMuted);
 auto*c=box(root,26,283,358,65);text(c,"Sleep after",18,21,240,&lv_font_montserrat_20);text(c,"5 sec",262,21,85,&lv_font_montserrat_20,kLime);
 text(root,"Brightness",30,366,350,&lv_font_montserrat_16,kMuted);
 auto*s=lv_slider_create(root);lv_obj_set_pos(s,38,403);lv_obj_set_size(s,334,10);lv_slider_set_range(s,15,100);lv_slider_set_value(s,brightness,LV_ANIM_OFF);
 lv_obj_set_style_bg_color(s,color(kLime),LV_PART_INDICATOR);lv_obj_set_style_bg_color(s,color(kWhite),LV_PART_KNOB);
 lv_obj_add_event_cb(s,brightnessEvent,LV_EVENT_VALUE_CHANGED,nullptr);footer(ACTIVITY,MAP);
}
static void show(Page p){
 powerArc=nullptr;mapDot=nullptr;page=p;root=lv_screen_active();lv_obj_clean(root);lv_obj_set_style_bg_color(root,color(kBlack),0);lv_obj_remove_flag(root,LV_OBJ_FLAG_SCROLLABLE);
 value=detail=plot=status=clockLabel=batteryLabel=mapView=nullptr;placeLabel=coordsLabel=plateLabel=declarationLabel=nullptr;
 switch(p){case HOME:home();break;case APPS:apps();break;case MAP:map();break;case MOTION:motion();break;case VEHICLE:vehicle();break;case ACTIVITY:activity();break;case POWER:power();break;default:break;}
 if(pageChanged)pageChanged(p);
}
static void update(const Readings&r){
 data=r;char buf[120];if(clockLabel)lv_label_set_text(clockLabel,r.clock);
 if(page==MOTION){
  if(!r.imu){lv_label_set_text(value,"-- g");lv_label_set_text(detail,"Sensor unavailable");lv_label_set_text(status,"Check sensor connection");return;}
  snprintf(buf,sizeof(buf),"%.2f g",sqrtf(r.ax*r.ax+r.ay*r.ay+r.az*r.az));lv_label_set_text(value,buf);
  snprintf(buf,sizeof(buf),"Gyro  %.0f / %.0f / %.0f deg/s",r.gx,r.gy,r.gz);lv_label_set_text(detail,buf);
  snprintf(buf,sizeof(buf),"X %+.2f   Y %+.2f   Z %+.2f",r.ax,r.ay,r.az);lv_label_set_text(status,buf);
  float a[]={r.ax,r.ay,r.az};for(int i=0;i<3;i++)lv_chart_set_next_value(plot,series[i],int(a[i]*1000));
 }
 if(page==POWER){if(r.battery<0)snprintf(buf,sizeof(buf),"--");else snprintf(buf,sizeof(buf),"%d%%",r.battery);lv_label_set_text(value,buf);if(powerArc)lv_arc_set_value(powerArc,r.battery<0?0:r.battery);}
 if(page==HOME&&status)lv_label_set_text(status,r.imu?"Sensing":"Unavailable");
}
static void remoteView(const char*plate,const char*declaration,bool fresh,double lat,double lng){
 if(plateLabel&&*plate)lv_label_set_text(plateLabel,plate);
 if(declarationLabel&&*declaration){lv_label_set_text(declarationLabel,declaration);lv_obj_set_style_text_font(declarationLabel,&lv_font_montserrat_14,0);}
 if(mapDot&&page==MAP){int x=VenueMap::x(fresh?lng:VenueMap::LNG),y=VenueMap::y(fresh?lat:VenueMap::LAT);lv_obj_set_pos(mapDot,x-17,y-17);}
 if(placeLabel)lv_label_set_text(placeLabel,fresh?"Phone location":"Gate 7 / Auditorium");
 if(coordsLabel){char b[70];if(fresh)snprintf(b,sizeof(b),"%.5f, %.5f",lat,lng);else snprintf(b,sizeof(b),"Mahatma Mandir / Gandhinagar");lv_label_set_text(coordsLabel,b);}
}
static void poll(){if(requested>=0&&requested<COUNT){Page p=Page(requested);requested=-1;show(p);update(data);}}
}
