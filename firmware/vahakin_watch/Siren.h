#pragma once
#include <ESP_I2S.h>
#include <atomic>
#include "es8311.h"
I2SClass sirenI2s;
std::atomic<bool> sirenOn{false};
bool sirenReady=false;
void sirenTask(void*){
 int16_t samples[320];float phase=0;
 for(;;){
  bool enabled=sirenOn.load();digitalWrite(46,enabled?HIGH:LOW);
  float frequency=(millis()/350)%2?1050:750;
  for(int i=0;i<160;i++){phase+=frequency/16000;if(phase>=1)phase-=1;int16_t sample=enabled?int16_t(sinf(phase*6.2831853f)*11000):0;samples[i*2]=sample;samples[i*2+1]=sample;}
  sirenI2s.write((uint8_t*)samples,sizeof(samples));
 }
}
bool initSiren(){
 sirenI2s.setPins(41,45,40,-1,16);
 if(!sirenI2s.begin(I2S_MODE_STD,16000,I2S_DATA_BIT_WIDTH_16BIT,I2S_SLOT_MODE_STEREO,I2S_STD_SLOT_BOTH))return false;
 auto codec=es8311_create(0,ES8311_ADDRRES_0);if(!codec)return false;
 es8311_clock_config_t clock={false,false,true,16000*256,16000};
 if(es8311_init(codec,&clock,ES8311_RESOLUTION_16,ES8311_RESOLUTION_16)!=ESP_OK||es8311_sample_frequency_config(codec,clock.mclk_frequency,clock.sample_frequency)!=ESP_OK||es8311_microphone_config(codec,false)!=ESP_OK||es8311_voice_volume_set(codec,80,nullptr)!=ESP_OK)return false;
 return xTaskCreatePinnedToCore(sirenTask,"handling-siren",4096,nullptr,1,nullptr,0)==pdPASS;
}
