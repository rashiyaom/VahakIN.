#pragma once
/* Shared VahakIN hotspot demonstration runtime.
 * BASIC: ESP32-S3 / MPU6050 (SDA8 SCL9) / NEO-6M (RX16).
 * PLUS: Waveshare AMOLED 2.06 / QMI8658 (SDA15 SCL14), no GPS UART.
 * See each sketch README for setup and physical validation requirements.
 */
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <esp_system.h>
#include <mbedtls/md.h>
#include <sys/time.h>
#include "MotionDetector.h"
#if VAHAKIN_PLUS
static constexpr char FIRMWARE[]="plus-watch-1.0.0";
#else
static constexpr char FIRMWARE[]="hotspot-imu-1.0.0";
#endif
static constexpr uint32_t SAMPLE_MS=20, UPLOAD_MS=5000;
#if !VAHAKIN_PLUS
HardwareSerial gpsSerial(1);
#endif
Preferences preferences;
MotionDetector detector;
portMUX_TYPE sharedMux=portMUX_INITIALIZER_UNLOCKED;
uint8_t mpuAddress=0;
struct Movement { char id[37]; int64_t at; uint32_t duration; };
struct Snapshot {
  MotionDetector::State state; float acceleration,rotation; uint32_t qualified;
  double lat,lng; float hdop; int satellites; int64_t gpsAt; uint32_t gpsMillis;
};
Snapshot shared={MotionDetector::Calibrating,0,0,0,0,0,99,0,0,0};
// Bounded FIFO retains the first eight unacknowledged motion events across outages/reboots.
Movement events[8]={}; uint8_t eventCount=0; uint32_t eventRevision=0,droppedEvents=0;

int64_t epochMs(){ timeval t;gettimeofday(&t,nullptr);return int64_t(t.tv_sec)*1000+t.tv_usec/1000; }
bool clockReady(){return epochMs()>1735689600000LL;}
void uuid(char out[37]){
 uint8_t b[16];esp_fill_random(b,sizeof(b));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 snprintf(out,37,"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7],b[8],b[9],b[10],b[11],b[12],b[13],b[14],b[15]);
}
bool writeRegister(uint8_t reg,uint8_t value){Wire.beginTransmission(mpuAddress);Wire.write(reg);Wire.write(value);return Wire.endTransmission()==0;}
bool readRegisters(uint8_t reg,uint8_t *out,size_t count){
 Wire.beginTransmission(mpuAddress);Wire.write(reg);if(Wire.endTransmission(false)!=0)return false;
 if(Wire.requestFrom(mpuAddress,count,true)!=count)return false;
 for(size_t i=0;i<count;i++)out[i]=Wire.read();return true;
}
bool initMpu(){
#if VAHAKIN_PLUS
 // Waveshare ESP32-S3-Touch-AMOLED-2.06: QMI8658 on SDA15 / SCL14.
 for(uint8_t address:{uint8_t(0x6B),uint8_t(0x6A)}){
  mpuAddress=address;uint8_t who=0;
  if(!readRegisters(0x00,&who,1)||who!=0x05)continue;
  // Reset any factory-app FIFO/sync configuration before direct register sampling.
  if(!writeRegister(0x60,0xB0))return false;
  uint8_t resetResult=0;uint32_t resetAt=millis();
  do{delay(10);if(!readRegisters(0x4D,&resetResult,1))return false;}while(resetResult!=0x80&&millis()-resetAt<500);
  if(resetResult!=0x80)return false;
  // Disable, enable address auto-increment, +/-4 g at125 Hz, +/-256 dps at112.1 Hz.
  if(!writeRegister(0x08,0)||!writeRegister(0x02,0x40)||!writeRegister(0x03,0x16)||
     !writeRegister(0x04,0x46)||!writeRegister(0x06,0x77)||!writeRegister(0x08,3))return false;
  delay(30);detector.reset();return true;
 }
 return false;
#else
 for(uint8_t address:{uint8_t(0x68),uint8_t(0x69)}){
  mpuAddress=address;uint8_t who=0;
  if(readRegisters(0x75,&who,1) && (who&0x7e)==0x68){
   // PLL gyro clock, 21 Hz DLPF, 50 Hz sample rate, +/-2 g, +/-250 degrees/s.
   if(!writeRegister(0x6B,1)||!writeRegister(0x1A,4)||!writeRegister(0x19,19)||!writeRegister(0x1B,0)||!writeRegister(0x1C,0))return false;
   detector.reset();return true;
  }
 }
 return false;
#endif
}
float word(const uint8_t *b){return int16_t((uint16_t(b[0])<<8)|b[1]);}
#if !VAHAKIN_PLUS
// NMEA parser validates checksum, fix validity and a matched GGA/RMC UTC epoch.
// Empty fields are preserved, so a no-fix sentence cannot shift column meanings.
char nmea[128];size_t nmeaLength=0;bool receiving=false;
char ggaTime[16]="";float ggaHdop=99;int ggaSatellites=0,ggaQuality=0;uint32_t ggaReceived=0;
double coordinate(const char *value,const char *direction){
 char *tail=nullptr;double raw=strtod(value,&tail),deg=floor(raw/100),minutes=raw-deg*100;
 if(!*value||*tail||!isfinite(raw)||raw<0||minutes>=60||strlen(direction)!=1||!strchr("NSEW",*direction))return NAN;
 return (deg+minutes/60)*((*direction=='S'||*direction=='W')?-1:1);
}
char rmcTime[16]="";double rmcLat=0,rmcLng=0;int64_t rmcAt=0;uint32_t rmcReceived=0;
void reconcileFix(){
 if(!rmcAt||ggaQuality<1||ggaQuality>2||millis()-ggaReceived>2000||millis()-rmcReceived>2000||strncmp(ggaTime,rmcTime,6)!=0||!isfinite(ggaHdop)||ggaHdop<.1||ggaSatellites<1||llabs(epochMs()-rmcAt)>10000)return;
 portENTER_CRITICAL(&sharedMux);shared.lat=rmcLat;shared.lng=rmcLng;shared.hdop=ggaHdop;shared.satellites=ggaSatellites;shared.gpsAt=rmcAt;shared.gpsMillis=millis();portEXIT_CRITICAL(&sharedMux);
}
void parseNmea(){
 char *star=strchr(nmea,'*');if(!star||strlen(star+1)!=2)return;
 uint8_t sum=0;for(char *p=nmea+1;p<star;p++)sum^=*p;
 char *end=nullptr;unsigned long expected=strtoul(star+1,&end,16);if(*end||sum!=expected)return;
 *star=0;char *fields[24];int count=0;fields[count++]=nmea;
 for(char *p=nmea;*p&&count<24;p++)if(*p==','){*p=0;fields[count++]=p+1;}
 if(strlen(fields[0])!=6)return;
 if(strcmp(fields[0]+3,"GGA")==0 && count>9){
  snprintf(ggaTime,sizeof(ggaTime),"%s",fields[1]);ggaQuality=atoi(fields[6]);ggaSatellites=atoi(fields[7]);ggaHdop=*fields[8]?atof(fields[8]):99;ggaReceived=millis();reconcileFix();
 }
 if(strcmp(fields[0]+3,"RMC")!=0||count<10)return;
 if(strcmp(fields[2],"A")!=0){rmcAt=0;portENTER_CRITICAL(&sharedMux);shared.gpsAt=0;portEXIT_CRITICAL(&sharedMux);return;}
 if(strlen(fields[1])<6||strlen(fields[9])!=6)return;
 for(int i=0;i<6;i++)if(fields[1][i]<'0'||fields[1][i]>'9'||fields[9][i]<'0'||fields[9][i]>'9')return;
 if(strlen(fields[3])==0||strlen(fields[5])==0||strlen(fields[4])!=1||strlen(fields[6])!=1||!strchr("NS",fields[4][0])||!strchr("EW",fields[6][0]))return;
 tm t={};char part[3]={};
 auto pair=[&](const char *p){part[0]=p[0];part[1]=p[1];return atoi(part);};
 t.tm_hour=pair(fields[1]);t.tm_min=pair(fields[1]+2);t.tm_sec=pair(fields[1]+4);
 t.tm_mday=pair(fields[9]);t.tm_mon=pair(fields[9]+2)-1;t.tm_year=100+pair(fields[9]+4);
 if(t.tm_year<125||t.tm_mon<0||t.tm_mon>11||t.tm_mday<1||t.tm_mday>31||t.tm_hour>23||t.tm_min>59||t.tm_sec>59)return;
 // TZ is UTC in setup. mktime uses UTC, including on GPS-only clock startup.
 int64_t fixAt=int64_t(mktime(&t))*1000;
 double lat=coordinate(fields[3],fields[4]),lng=coordinate(fields[5],fields[6]);
 if(!isfinite(lat)||!isfinite(lng)||fabs(lat)>90||fabs(lng)>180)return;
 if(!clockReady()){timeval tv={time_t(fixAt/1000),0};settimeofday(&tv,nullptr);}
 snprintf(rmcTime,sizeof(rmcTime),"%s",fields[1]);rmcLat=lat;rmcLng=lng;rmcAt=fixAt;rmcReceived=millis();reconcileFix();
}
void readGps(){
 while(gpsSerial.available()){
  char c=gpsSerial.read();if(c=='$'){nmeaLength=0;receiving=true;}
  if(!receiving)continue;
  if(c=='\r'||c=='\n'){if(nmeaLength){nmea[nmeaLength]=0;parseNmea();}receiving=false;continue;}
  if(nmeaLength>=sizeof(nmea)-1){receiving=false;nmeaLength=0;continue;}nmea[nmeaLength++]=c;
 }
}
#endif
void sensorTask(void *){
 TickType_t wake=xTaskGetTickCount();uint32_t lastTry=0,lastSample=0;bool healthy=false;
 for(;;){
  #if !VAHAKIN_PLUS
  readGps();
  #endif
  uint32_t now=millis();
  if(!healthy&&(now-lastTry>=2000||lastTry==0)){lastTry=now;healthy=initMpu();}
  uint8_t bytes[14];bool event=false;
  if(healthy){
   if(lastSample&&now-lastSample>100)detector.reset(); // Missed samples never count toward persistence.
   #if VAHAKIN_PLUS
   auto little=[](const uint8_t *b){return float(int16_t(uint16_t(b[0])|(uint16_t(b[1])<<8)));};
   uint8_t ready=0;
   if(readRegisters(0x2E,&ready,1)&&(ready&3)==3&&readRegisters(0x35,bytes,12))event=detector.update(little(bytes)/8192.f,little(bytes+2)/8192.f,little(bytes+4)/8192.f,little(bytes+6)/128.f,little(bytes+8)/128.f,little(bytes+10)/128.f);
   #else
   if(readRegisters(0x3B,bytes,sizeof(bytes)))event=detector.update(word(bytes)/16384.f,word(bytes+2)/16384.f,word(bytes+4)/16384.f,word(bytes+8)/131.f,word(bytes+10)/131.f,word(bytes+12)/131.f);
   #endif
   else{healthy=false;detector.reset();detector.state=MotionDetector::Fault;}
  }else detector.state=MotionDetector::Fault;
  lastSample=now;
  Movement movement={};if(event){uuid(movement.id);movement.at=clockReady()?epochMs():0;movement.duration=detector.qualifiedMs;}
  portENTER_CRITICAL(&sharedMux);
  shared.state=detector.state;shared.acceleration=detector.accelerationG;shared.rotation=detector.rotationDps;shared.qualified=detector.qualifiedMs;
  if(event){if(movement.at&&eventCount<8){events[eventCount++]=movement;eventRevision++;}else droppedEvents++;}
  portEXIT_CRITICAL(&sharedMux);
  // Never catch up by sampling in a burst after initialization or an I2C stall.
  // Such duplicate readings would incorrectly count as elapsed motion/calibration time.
  if(xTaskGetTickCount()-wake>=pdMS_TO_TICKS(SAMPLE_MS))wake=xTaskGetTickCount();
  vTaskDelayUntil(&wake,pdMS_TO_TICKS(SAMPLE_MS));
 }
}
String signature(const String &body){
 unsigned char digest[32];char hex[65];
 if(mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),reinterpret_cast<const unsigned char*>(DEVICE_SECRET),strlen(DEVICE_SECRET),reinterpret_cast<const unsigned char*>(body.c_str()),body.length(),digest)!=0)return "";
 for(int i=0;i<32;i++)snprintf(hex+i*2,3,"%02x",digest[i]);return String(hex);
}
void persistEvents(){
 static uint32_t saved=UINT32_MAX;Movement copy[8];uint8_t count;uint32_t revision;
 portENTER_CRITICAL(&sharedMux);revision=eventRevision;count=eventCount;memcpy(copy,events,sizeof(copy));portEXIT_CRITICAL(&sharedMux);
 if(saved==revision)return;
 struct Saved {uint32_t magic;uint8_t count;Movement items[8];} data={0x56414831,count,{}};
 memcpy(data.items,copy,sizeof(copy));
 if(preferences.putBytes("events",&data,sizeof(data))==sizeof(data))saved=revision;
}
bool localEndpoint(const String &url){
 if(!url.startsWith("http://"))return false;
 String host=url.substring(7);int end=host.indexOf('/');if(end>=0)host=host.substring(0,end);int port=host.indexOf(':');if(port>=0)host=host.substring(0,port);
 IPAddress ip;if(!ip.fromString(host))return false;
 return ip[0]==10||(ip[0]==192&&ip[1]==168)||(ip[0]==172&&ip[1]>=16&&ip[1]<=31);
}
void setup(){
 Serial.begin(115200);setenv("TZ","UTC0",1);tzset();
 Wire.begin(MPU_SDA,MPU_SCL,400000);Wire.setTimeOut(25);
#if !VAHAKIN_PLUS
 gpsSerial.setRxBufferSize(2048);gpsSerial.begin(9600,SERIAL_8N1,GPS_RX,-1);
#endif
 preferences.begin("vahakin-motion",false);
 struct Saved {uint32_t magic;uint8_t count;Movement items[8];} data={};
 if(preferences.getBytesLength("events")==sizeof(data)&&preferences.getBytes("events",&data,sizeof(data))==sizeof(data)&&data.magic==0x56414831&&data.count<=8){eventCount=data.count;memcpy(events,data.items,sizeof(events));}
 WiFi.persistent(false);WiFi.mode(WIFI_STA);WiFi.setSleep(false);WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
 configTime(0,0,"pool.ntp.org","time.google.com");
 if(xTaskCreatePinnedToCore(sensorTask,"imu-gps",6144,nullptr,2,nullptr,1)!=pdPASS){Serial.println("Sensor task could not start");for(;;)delay(1000);}
 Serial.println("VahakIN hardware demo: keep the dashboard device still for 5 seconds. No cellular transport.");
}
void loop(){
 static uint32_t lastConnect=0,lastUpload=0,retryDelay=UPLOAD_MS,lastDiagnostic=0;
 static String pending="",pendingNonce="",pendingMovement="";static int64_t pendingAt=0;
 persistEvents();uint32_t now=millis();
 if(now-lastDiagnostic>=10000){lastDiagnostic=now;Snapshot s;uint32_t dropped;uint8_t queued;portENTER_CRITICAL(&sharedMux);s=shared;dropped=droppedEvents;queued=eventCount;portEXIT_CRITICAL(&sharedMux);Serial.printf("WiFi=%s IMU=%d dynamic=%.3fg rotation=%.1fdps GPS=%s queued=%u lost=%lu clock=%s\n",WiFi.status()==WL_CONNECTED?"online":"offline",int(s.state),s.acceleration,s.rotation,s.gpsAt&&now-s.gpsMillis<10000?"fresh":"unavailable",queued,(unsigned long)dropped,clockReady()?"ready":"waiting");}
 if(WiFi.status()!=WL_CONNECTED){if(now-lastConnect>=15000){lastConnect=now;WiFi.reconnect();}delay(20);return;}
 if(!clockReady()||now-lastUpload<retryDelay){delay(20);return;}
 lastUpload=now;
 if(strlen(DEVICE_SECRET)!=64){Serial.println("Provision the device secret before uploading.");retryDelay=60000;return;}
 if(pending.length()&&epochMs()-pendingAt>240000)pending=""; // Refresh signature timestamp; retain queued movement evidence.
 if(!pending.length()){
  Snapshot s;Movement m={};bool hasEvent;
  portENTER_CRITICAL(&sharedMux);s=shared;hasEvent=eventCount>0;if(hasEvent)m=events[0];portEXIT_CRITICAL(&sharedMux);
  char nonce[37];uuid(nonce);pendingNonce=nonce;pendingMovement=hasEvent?m.id:"";pendingAt=epochMs();
  const char *state=s.state==MotionDetector::Calibrating?"Calibrating":s.state==MotionDetector::Fault?"Sensor fault":s.state==MotionDetector::Moving&&hasEvent?"Moving":"Stationary";
  // Moving state remains visible after event acknowledgement using the last acknowledged identity.
  static Movement lastAck={};
  if(!hasEvent && s.state==MotionDetector::Moving && lastAck.at){m=lastAck;state="Moving";}
  if(hasEvent)lastAck=m;
  String movement=m.at?String("\"")+m.id+"\"":"null";
  char body[1600],gps[240];strcpy(gps,"null");
  if(s.gpsAt&&now-s.gpsMillis<=10000&&s.gpsAt<=pendingAt)snprintf(gps,sizeof(gps),"{\"lat\":%.7f,\"lng\":%.7f,\"hdop\":%.2f,\"satellites\":%d,\"fixAt\":%lld}",s.lat,s.lng,s.hdop,s.satellites,(long long)s.gpsAt);
  char movedAt[32];if(m.at)snprintf(movedAt,sizeof(movedAt),"%lld",(long long)m.at);else strcpy(movedAt,"null");
  int length=snprintf(body,sizeof(body),"{\"deviceId\":\"%s\",\"timestamp\":%lld,\"nonce\":\"%s\",\"firmware\":\"%s\",\"uptimeMs\":%lu,\"imu\":{\"state\":\"%s\",\"accelerationG\":%.4f,\"rotationDps\":%.3f,\"qualifiedMotionMs\":%lu,\"movementId\":%s,\"movementAt\":%s},\"gps\":%s}",DEVICE_ID,(long long)pendingAt,nonce,FIRMWARE,(unsigned long)now,state,s.acceleration,s.rotation,(unsigned long)(m.at?m.duration:s.qualified),movement.c_str(),movedAt,gps);
  if(length<0||length>=int(sizeof(body))){Serial.println("Telemetry buffer exceeded");return;}pending=body;
 }
 WiFiClient plain;WiFiClientSecure secure;HTTPClient http;String url=TELEMETRY_URL;bool begun=false;
 if(url.startsWith("https://")&&strlen(ROOT_CA)>0){secure.setCACert(ROOT_CA);begun=http.begin(secure,url);}
 else if(ALLOW_LOCAL_HTTP&&localEndpoint(url))begun=http.begin(plain,url);
 if(!begun){Serial.println("Configure a private LAN HTTP endpoint or verified HTTPS CA.");retryDelay=60000;return;}
 http.setConnectTimeout(3000);http.setTimeout(4000);http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
 http.addHeader("Content-Type","application/json");http.addHeader("x-vahakin-signature",signature(pending));
 int status=http.POST(pending);String response=status==200?http.getString():"";http.end();
 if(status==200&&response.indexOf(pendingNonce)>=0){
  portENTER_CRITICAL(&sharedMux);
  if(eventCount&&pendingMovement==events[0].id){for(uint8_t i=1;i<eventCount;i++)events[i-1]=events[i];eventCount--;eventRevision++;}
  portEXIT_CRITICAL(&sharedMux);
  pending="";retryDelay=UPLOAD_MS;Serial.println("Telemetry acknowledged by website.");
 }else{retryDelay=status==401||status==409||status==429?60000:min(uint32_t(60000),retryDelay*2);Serial.printf("Upload status=%d; retry in %lu ms. Sensor sampling continues.\n",status,(unsigned long)retryDelay);}
 delay(20);
}
