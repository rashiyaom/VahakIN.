#!/usr/bin/env python3
"""Convert an OSM XML extract to compact LVGL paths. OSM data: ODbL 1.0."""
import sys, xml.etree.ElementTree as ET
from pathlib import Path
root=ET.parse(sys.argv[1]).getroot()
nodes={e.get('id'):(float(e.get('lat')),float(e.get('lon'))) for e in root.findall('node')}
def point(p):return (round((p[1]-72.629)*160000),round((23.237-p[0])*174000))
paths=[]
for way in root.findall('way'):
 tags={t.get('k'):t.get('v') for t in way.findall('tag')}
 road=tags.get('highway');building='building' in tags
 if not road and not building:continue
 pts=[point(nodes[n.get('ref')]) for n in way.findall('nd') if n.get('ref') in nodes]
 # Limit data to this 1.1 km x 1.0 km offline area; LVGL clips crossing segments.
 if not any(0<=x<=1760 and 0<=y<=1566 for x,y in pts):continue
 pts=[(max(-100,min(1860,x)),max(-100,min(1666,y))) for x,y in pts]
 pts=list(dict.fromkeys(pts)) if not building else pts
 if len(pts)<2:continue
 width=2 if building else 12 if road in ('primary','secondary','tertiary') else 6 if road not in ('footway','path','steps') else 2
 color=0x334139 if building else 0x7d8069 if width==12 else 0x505e53
 paths.append((pts,width,color))
out=['#pragma once','#include <lvgl.h>','// Derived from OpenStreetMap contributors, ODbL 1.0. See README.','namespace VenueMap {','constexpr int W=1760,H=1566;','constexpr double LAT=23.23127,LNG=72.63359;']
for i,(pts,_,_) in enumerate(paths):out.append('static const lv_point_precise_t p%d[]={%s};'%(i,','.join('{%d,%d}'%p for p in pts)))
out+=['struct Path {const lv_point_precise_t *points; unsigned count; unsigned width; unsigned color;};','static const Path paths[]={']
for i,(pts,w,c) in enumerate(paths):out.append('{p%d,%d,%d,0x%x},'%(i,len(pts),w,c))
out+=['};','inline int x(double lng){return int((lng-72.629)*160000);}','inline int y(double lat){return int((23.237-lat)*174000);}','}']
Path('firmware/vahakin_watch/VenueMap.h').write_text('\n'.join(out)+'\n')
print(f'Created {len(paths)} road/building paths from public OSM geometry.')

import html
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1760" height="1566" viewBox="0 0 1760 1566"><rect width="1760" height="1566" fill="#18251f"/>']
for pts,w,c in paths:
 svg.append('<polyline points="%s" stroke="#%06x" stroke-width="%d" stroke-linejoin="round" fill="none"/>'%(' '.join('%d,%d'%p for p in pts),c,w))
for label,lat,lng in [('Mahatma Mandir',23.23185,72.6330),('Dandi Kutir',23.2328,72.6304),('Sector 13',23.2292,72.6361),('Sector 14',23.2365,72.6324),('Sector 15',23.2347,72.6382),('Station Road',23.2337,72.6319),('KH Road',23.2300,72.6383)]:
 x,y=point((lat,lng));svg.append(f'<text x="{x}" y="{y+16}" fill="#c6d3bb" font-family="Arial" font-size="16">{html.escape(label)}</text>')
x,y=point((23.23127,72.63359));svg.append(f'<circle cx="{x}" cy="{y}" r="90" fill="#41673b" fill-opacity=".15" stroke="#d4f590" stroke-width="2"/><circle cx="{x}" cy="{y}" r="14" fill="#80bfff" stroke="#fff" stroke-width="5"/></svg>')
Path('deliverables/watch-ui/venue-map.svg').write_text(''.join(svg))
