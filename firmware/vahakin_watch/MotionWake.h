#pragma once
#include <cmath>
#include <cstdint>

// The hardware WoM threshold uses mg; the awake filter uses the same 0.18 g.
// Touch deliberately does not extend this timer. Unsigned elapsed handles rollover.
class MotionWake {
 public:
  static constexpr uint32_t idleMs = 30000;
  static constexpr uint8_t thresholdMg = 180;
  void start(uint32_t now) { lastMotion = now; seeded = false; streak = 0; }
  bool sample(uint32_t now, float x, float y, float z, float gx, float gy, float gz) {
    if (!std::isfinite(x+y+z+gx+gy+gz)) return false;
    if (!seeded) { bx=x; by=y; bz=z; seeded=true; previous=now; return false; }
    uint32_t dt=now-previous; previous=now;
    float delta=fmaxf(fabsf(x-bx), fmaxf(fabsf(y-by), fabsf(z-bz)));
    float spin=fmaxf(fabsf(gx), fmaxf(fabsf(gy),fabsf(gz)));
    bool major=delta >= thresholdMg/1000.f || spin >= 25.f;
    streak=major && dt<=100 ? streak+dt : 0;
    bx += .025f*(x-bx); by += .025f*(y-by); bz += .025f*(z-bz);
    if (streak>=60) { lastMotion=now; return true; }
    return false;
  }
  bool expired(uint32_t now) const { return uint32_t(now-lastMotion)>=idleMs; }
  uint32_t remaining(uint32_t now) const { auto d=uint32_t(now-lastMotion); return d>=idleMs?0:idleMs-d; }
 private:
  uint32_t lastMotion=0, previous=0, streak=0;
  float bx=0,by=0,bz=1;
  bool seeded=false;
};
