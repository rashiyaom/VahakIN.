import { it, expect } from "vitest";
import { requestHasSameOrigin } from "../../lib/server/origin";
it("accepts same-origin LAN and localhost requests to a wildcard-bound dev server",()=>{
  for(const host of ["localhost:3001","10.231.64.5:3000"]){
    const r=new Request("http://0.0.0.0:3001/api/session",{headers:{host,origin:`http://${host}`}});
    expect(requestHasSameOrigin(r,true)).toBe(true);expect(requestHasSameOrigin(r,false)).toBe(false);
  }
});
it("rejects cross-origin, absent, null and malformed origins",()=>{
  for(const origin of ["https://evil.test","null","http://localhost:3001/","http://localhost:3001@evil.test"])
    expect(requestHasSameOrigin(new Request("http://0.0.0.0:3001/api/session",{headers:{host:"localhost:3001",origin}}),true)).toBe(false);
  expect(requestHasSameOrigin(new Request("http://localhost:3001/api/session"),true)).toBe(false);
});
