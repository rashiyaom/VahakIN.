#include <Arduino.h>
#include <Wire.h>
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <cJSON.h>
#include "pin_config.h"
#include <Arduino_GFX_Library.h>
#include <Arduino_DriveBus_Library.h>
#include <SensorQMI8658.hpp>
#include <XPowersLib.h>
#include "MotionWake.h"
#include "WatchUI.h"

// Reuse the provisioned Plus identity and signed upload queue, never fixture GPS.
#define VAHAKIN_PLUS 1
#define VAHAKIN_EXTERNAL_SENSOR 1
#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.example.h"
#endif
void watchResponse(const String &response);
#define VAHAKIN_TELEMETRY_RESPONSE watchResponse
#define setup transportSetup
#define loop transportLoop
#include <VahakinDemo.h>
#undef setup
#undef loop

Arduino_ESP32QSPI displayBus(12,11,4,5,6,7);
Arduino_CO5300 display(&displayBus,8,0,410,502,22,0,0,0);
SensorQMI8658 imu;
XPowersPMU power;
std::shared_ptr<Arduino_IIC_DriveBus> touchBus=std::make_shared<Arduino_HWIIC>(15,14,&Wire);
void touchIRQ(){}
Arduino_FT3x68 touch(touchBus,FT3168_DEVICE_ADDRESS,9,38,touchIRQ);
MotionWake motionWake;
WatchUI::Readings reading;
RTC_DATA_ATTR uint32_t savedMagic=0;
RTC_DATA_ATTR uint8_t savedDetector[sizeof(MotionDetector)];
RTC_DATA_ATTR int savedPage=WatchUI::HOME;
RTC_DATA_ATTR int savedBrightness=70;
volatile bool stopNetwork=false,networkStopped=false;
bool sensorOK=false,powerOK=false,touchOK=false,screenAwake=false,displayReady=false,panelSleeping=false;
char timeText[8]="--:--";
uint32_t lastSample=0,lastFrame=0,lastPower=0,lastPersist=0,lastSensorTry=0;
struct RemoteView { char registration[40]; char declaration[60]; double lat,lng; int64_t at; bool hasLocation; };
RemoteView remote={};

void watchResponse(const String &response){
 cJSON *json=cJSON_Parse(response.c_str());if(!json)return;
 cJSON *view=cJSON_GetObjectItemCaseSensitive(json,"watch");RemoteView next={};
 auto copy=[](cJSON*o,const char*k,char*out,size_t n){auto*v=cJSON_GetObjectItemCaseSensitive(o,k);if(cJSON_IsString(v)&&v->valuestring)snprintf(out,n,"%s",v->valuestring);};
 if(cJSON_IsObject(view)){
  copy(view,"registration",next.registration,sizeof(next.registration));copy(view,"declaration",next.declaration,sizeof(next.declaration));
  auto*l=cJSON_GetObjectItemCaseSensitive(view,"location");
  auto*la=cJSON_GetObjectItemCaseSensitive(l,"lat"),*lo=cJSON_GetObjectItemCaseSensitive(l,"lng"),*at=cJSON_GetObjectItemCaseSensitive(l,"at");
  if(cJSON_IsNumber(la)&&cJSON_IsNumber(lo)&&cJSON_IsNumber(at)){
   next.lat=la->valuedouble;next.lng=lo->valuedouble;next.at=int64_t(at->valuedouble);next.hasLocation=true;
  }
 }
 portENTER_CRITICAL(&sharedMux);remote=next;portEXIT_CRITICAL(&sharedMux);cJSON_Delete(json);
}
void networkTask(void*){
 while(!stopNetwork){transportLoop();vTaskDelay(pdMS_TO_TICKS(10));}
 networkStopped=true;vTaskDelete(nullptr);
}
bool initSensor(){
 if(!imu.begin(Wire,0x6B,15,14)&&!imu.begin(Wire,0x6A,15,14))return false;
 if(!imu.reset())return false;
 imu.configAccelerometer(SensorQMI8658::ACC_RANGE_4G,SensorQMI8658::ACC_ODR_125Hz,SensorQMI8658::LPF_MODE_3);
 imu.configGyroscope(SensorQMI8658::GYR_RANGE_256DPS,SensorQMI8658::GYR_ODR_112_1Hz,SensorQMI8658::LPF_MODE_3);
 imu.enableAccelerometer();imu.enableGyroscope();return true;
}
void flushDisplay(lv_display_t*d,const lv_area_t*a,uint8_t*p){
 display.draw16bitRGBBitmap(a->x1,a->y1,(uint16_t*)p,lv_area_get_width(a),lv_area_get_height(a));lv_display_flush_ready(d);
}
void roundDisplay(lv_event_t*e){
 auto*a=(lv_area_t*)lv_event_get_param(e);a->x1&=~1;a->y1&=~1;a->x2|=1;a->y2|=1;
 a->x1=max(0,int(a->x1));a->y1=max(0,int(a->y1));a->x2=min(409,int(a->x2));a->y2=min(501,int(a->y2));
}
void readTouch(lv_indev_t*,lv_indev_data_t*d){
 d->state=LV_INDEV_STATE_RELEASED;if(!touchOK||!screenAwake)return;
 auto fingers=touch.IIC_Read_Device_Value(touch.Arduino_IIC_Touch::Value_Information::TOUCH_FINGER_NUMBER);
 if(fingers<1||fingers>2)return;
 int x=touch.IIC_Read_Device_Value(touch.Arduino_IIC_Touch::Value_Information::TOUCH_COORDINATE_X);
 int y=touch.IIC_Read_Device_Value(touch.Arduino_IIC_Touch::Value_Information::TOUCH_COORDINATE_Y);
 if(x>=0&&x<410&&y>=0&&y<502){d->point={int32_t(x),int32_t(y)};d->state=LV_INDEV_STATE_PRESSED;}
}
void initDisplay(){
 displayReady=display.begin();if(!displayReady){Serial.println("Display initialization failed");return;}
 display.setBrightness(0);display.fillScreen(0);
 lv_init();lv_tick_set_cb([](){return uint32_t(millis());});
 auto*buffer=(uint16_t*)heap_caps_malloc(410*40*2,MALLOC_CAP_INTERNAL|MALLOC_CAP_8BIT);
 if(!buffer){displayReady=false;Serial.println("Display buffer unavailable");return;}
 auto*d=lv_display_create(410,502);lv_display_set_color_format(d,LV_COLOR_FORMAT_RGB565);
 lv_display_set_buffers(d,buffer,nullptr,410*40*2,LV_DISPLAY_RENDER_MODE_PARTIAL);
 lv_display_set_flush_cb(d,flushDisplay);lv_display_add_event_cb(d,roundDisplay,LV_EVENT_INVALIDATE_AREA,nullptr);
 touchOK=touch.begin();auto*i=lv_indev_create();lv_indev_set_type(i,LV_INDEV_TYPE_POINTER);lv_indev_set_read_cb(i,readTouch);
 WatchUI::pageChanged=[](int p){savedPage=p;};
 WatchUI::brightness=savedBrightness;
 WatchUI::brightnessChanged=[](int value){savedBrightness=value;if(screenAwake)display.setBrightness(value*255/100);};
 WatchUI::show(WatchUI::Page(savedPage>=0&&savedPage<WatchUI::COUNT?savedPage:0));
}
void sampleSensor(uint32_t now){
 if(!sensorOK){if(now-lastSensorTry>=2000){lastSensorTry=now;sensorOK=initSensor();}reading.imu=false;portENTER_CRITICAL(&sharedMux);shared.state=MotionDetector::Fault;portEXIT_CRITICAL(&sharedMux);return;}
 if(!imu.getDataReady()){
  if(lastSample&&now-lastSample>250){sensorOK=false;reading.imu=false;detector.reset();detector.state=MotionDetector::Fault;}
  return; // Absence of a new sample is not a fabricated zero.
 }
 if(!imu.getAccelerometer(reading.ax,reading.ay,reading.az)||!imu.getGyroscope(reading.gx,reading.gy,reading.gz)){
  sensorOK=false;reading.imu=false;detector.reset();detector.state=MotionDetector::Fault;return;
 }
 reading.imu=true;
 if(lastSample&&now-lastSample>100)detector.resumeAfterSleep();lastSample=now;
 bool major=motionWake.sample(now,reading.ax,reading.ay,reading.az,reading.gx,reading.gy,reading.gz);
 if(major&&!screenAwake&&displayReady){screenAwake=true;if(panelSleeping){display.displayOn();panelSleeping=false;}display.setBrightness(savedBrightness*255/100);}
 bool event=detector.update(reading.ax,reading.ay,reading.az,reading.gx,reading.gy,reading.gz);
 Movement movement={};if(event){uuid(movement.id);movement.at=clockReady()?epochMs():0;movement.duration=detector.qualifiedMs;}
 portENTER_CRITICAL(&sharedMux);
 shared.state=detector.state;shared.acceleration=detector.accelerationG;shared.rotation=detector.rotationDps;shared.qualified=detector.qualifiedMs;
 if(event){if(movement.at&&eventCount<8){events[eventCount++]=movement;eventRevision++;}else droppedEvents++;}
 portEXIT_CRITICAL(&sharedMux);
}
bool sleepPrepared=false;
void sleepWhenStill(){
 if(!sleepPrepared){
  if(displayReady&&!panelSleeping){display.setBrightness(0);display.displayOff();panelSleeping=true;}screenAwake=false;
  // Keep PMU sensor rail powered. WoM itself is low-power accelerometer-only.
  int result=sensorOK?imu.configWakeOnMotion(MotionWake::thresholdMg,SensorQMI8658::ACC_ODR_LOWPOWER_128Hz,SensorQMI8658::INTERRUPT_PIN_1,0,8):-1;
  if(result!=0){Serial.println("WoM unavailable; remain dark and retry sensor, no blind deep sleep");sensorOK=false;motionWake.start(millis());return;}
  rtc_gpio_init(GPIO_NUM_21);rtc_gpio_set_direction(GPIO_NUM_21,RTC_GPIO_MODE_INPUT_ONLY);
  rtc_gpio_pullup_dis(GPIO_NUM_21);rtc_gpio_pulldown_en(GPIO_NUM_21);
  if(esp_sleep_enable_ext0_wakeup(GPIO_NUM_21,1)!=ESP_OK){Serial.println("Wake pin setup failed");rtc_gpio_deinit(GPIO_NUM_21);sensorOK=initSensor();motionWake.start(millis());return;}
  stopNetwork=true;sleepPrepared=true;
 }
 // Screen is already off at 5 s. Let the bounded in-flight HTTP request finish.
 if(!networkStopped)return;
 persistEvents();memcpy(savedDetector,&detector,sizeof(detector));savedMagic=0x56415732;
 if(touchOK)touch.IIC_Write_Device_State(touch.Arduino_IIC_Touch::Device::TOUCH_POWER_MODE,touch.Arduino_IIC_Touch::Device_Mode::TOUCH_POWER_HIBERNATE);
 if(powerOK){power.disableTemperatureMeasure();power.disableVbusVoltageMeasure();power.disableBattVoltageMeasure();power.disableSystemVoltageMeasure();}
 WiFi.disconnect(true);WiFi.mode(WIFI_OFF);digitalWrite(46,LOW);
 Serial.println("Deep sleep; IMU INT1/GPIO21 wakes on 180 mg movement");Serial.flush();esp_deep_sleep_start();
}
void setup(){
 rtc_gpio_deinit(GPIO_NUM_21);pinMode(46,OUTPUT);digitalWrite(46,LOW);
 transportSetup(); // Wi-Fi, NTP, durable event queue; sampling is owned by this sketch.
 sensorOK=initSensor();powerOK=power.init(Wire,15,14);
 if(powerOK){power.enableBattDetection();power.enableBattVoltageMeasure();}
 bool motionBoot=esp_sleep_get_wakeup_cause()==ESP_SLEEP_WAKEUP_EXT0;
 detector.setCalibrationSamples(100); // Two quiet seconds fit within the five-second awake window.
 if(motionBoot&&savedMagic==0x56415732){memcpy(&detector,savedDetector,sizeof(detector));detector.resumeAfterSleep();}
 initDisplay();motionWake.start(millis());screenAwake=motionBoot;
 if(screenAwake&&displayReady)display.setBrightness(savedBrightness*255/100);
 if(xTaskCreatePinnedToCore(networkTask,"plus-network",12288,nullptr,1,nullptr,0)!=pdPASS){networkStopped=true;Serial.println("Network task unavailable");}
 Serial.println("VahakIN Plus UI ready; move to wake. GPS payload is always null.");
}
void loop(){
 uint32_t now=millis();
 if(sleepPrepared){sleepWhenStill();delay(5);return;}
 static uint32_t sampleDue=0;
 if(now-sampleDue>=20){sampleDue=now;sampleSensor(now);}
 if(now-lastPersist>=1000){lastPersist=now;persistEvents();}
 if(motionWake.expired(now)){sleepWhenStill();return;}
 if(now-lastPower>=1000){
  lastPower=now;reading.battery=powerOK&&power.isBatteryConnect()?power.getBatteryPercent():-1;reading.charging=powerOK&&power.isCharging();
  if(clockReady()){time_t local=time(nullptr)+19800;tm t;gmtime_r(&local,&t);strftime(timeText,sizeof(timeText),"%H:%M",&t);}reading.clock=timeText;
 }
 if(screenAwake&&displayReady){
  WatchUI::poll();
  if(now-lastFrame>=100){
   lastFrame=now;WatchUI::update(reading);RemoteView view;
   portENTER_CRITICAL(&sharedMux);view=remote;portEXIT_CRITICAL(&sharedMux);
   bool fresh=view.hasLocation&&clockReady()&&epochMs()-view.at>=-2000&&epochMs()-view.at<=15000;
   WatchUI::remoteView(view.registration,view.declaration,fresh,view.lat,view.lng);
  }
  lv_timer_handler();
 }
 delay(2);
}
