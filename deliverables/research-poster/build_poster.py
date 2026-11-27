"""Generate editable A2 landscape PPTX plus a matching print PDF; dimensions are millimetres."""
from pathlib import Path
import math,json,shutil
from PIL import Image
from pptx import Presentation
from pptx.util import Mm,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE,MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN,MSO_ANCHOR
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.lib.utils import simpleSplit
import fitz
R=Path(__file__).parent;A=R/'assets';W,H=594,420;U=72/25.4
N='163446';T='087F83';INK='233743';MUT='526773';LINE='D5E0E4';PALE='F0F6F7';WHITE='FFFFFF';AMBER='A56016'
for n,f in [('Arial','Arial.ttf'),('Arial-Bold','Arial Bold.ttf'),('Arial-Italic','Arial Italic.ttf')]:pdfmetrics.registerFont(TTFont(n,'/System/Library/Fonts/Supplemental/'+f))
p=Presentation();p.slide_width=Mm(W);p.slide_height=Mm(H);s=p.slides.add_slide(p.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string(WHITE)
c=canvas.Canvas(str(R/'VahakIN_A2_Research_Poster.pdf'),pagesize=(W*U,H*U));c.setTitle('VahakIN — A2 Research Poster');c.setAuthor('Team VahikIN. | CSPIT, CHARUSAT')
objects=[];warnings=[]
def rect(x,y,w,h,fill=WHITE,line=None,radius=False):
 sh=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,Mm(x),Mm(y),Mm(w),Mm(h));sh.fill.solid();sh.fill.fore_color.rgb=RGBColor.from_string(fill)
 if line:sh.line.color.rgb=RGBColor.from_string(line);sh.line.width=Pt(.65)
 else:sh.line.fill.background()
 if radius:
  try:sh.adjustments[0]=.08
  except:pass
 c.setFillColor(HexColor('#'+fill));c.setStrokeColor(HexColor('#'+(line or fill)));c.setLineWidth(.65)
 if radius:c.roundRect(x*U,(H-y-h)*U,w*U,h*U,2*U,fill=1,stroke=int(bool(line)))
 else:c.rect(x*U,(H-y-h)*U,w*U,h*U,fill=1,stroke=int(bool(line)))
 return sh

def line(x,y,x2,y2,color=LINE,width=.7):
 sh=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,Mm(x),Mm(y),Mm(x2),Mm(y2));sh.line.color.rgb=RGBColor.from_string(color);sh.line.width=Pt(width)
 c.setStrokeColor(HexColor('#'+color));c.setLineWidth(width);c.line(x*U,(H-y)*U,x2*U,(H-y2)*U)

def text(txt,x,y,w,h,size=14,bold=False,color=INK,align='left',italic=False,link=None):
 font='Arial-Bold' if bold else 'Arial-Italic' if italic else 'Arial';leading=size*1.18
 lines=[]
 for paragraph in txt.split('\n'):lines+=simpleSplit(paragraph,font,size,w*U) or ['']
 if len(lines)*leading>h*U+.5:warnings.append(f'Text overflow {txt[:48]}: {len(lines)*leading/U:.1f}>{h}mm')
 box=s.shapes.add_textbox(Mm(x),Mm(y),Mm(w),Mm(h));tf=box.text_frame;tf.clear();tf.word_wrap=False;tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0;tf.vertical_anchor=MSO_ANCHOR.TOP
 for i,L in enumerate(lines):
  par=tf.paragraphs[0] if i==0 else tf.add_paragraph();par.text=L;par.font.name='Arial';par.font.size=Pt(size);par.font.bold=bold;par.font.italic=italic;par.font.color.rgb=RGBColor.from_string(color);par.space_after=Pt(0);par.space_before=Pt(0);par.line_spacing=Pt(leading);par.alignment={'left':PP_ALIGN.LEFT,'center':PP_ALIGN.CENTER,'right':PP_ALIGN.RIGHT}[align]
  if link and par.runs:par.runs[0].hyperlink.address=link
  c.setFont(font,size);c.setFillColor(HexColor('#'+color));baseline=(H-y)*U-size-i*leading
  if align=='center':c.drawCentredString((x+w/2)*U,baseline,L)
  elif align=='right':c.drawRightString((x+w)*U,baseline,L)
  else:c.drawString(x*U,baseline,L)
 if link:c.linkURL(link,(x*U,(H-y-h)*U,(x+w)*U,(H-y)*U),relative=0)
 objects.append({'kind':'text','text':txt,'x':x,'y':y,'w':w,'h':h,'size':size});return box

def picture(file,x,y,w,h,crop=None,fit=False,link=None):
 file=Path(file);im=Image.open(file);iw,ih=im.size
 if crop:
  l,t,r,b=crop;cl=l/iw;cr=(iw-r)/iw;ct=t/ih;cb=(ih-b)/ih
 else:cl=cr=ct=cb=0
 vw=iw*(1-cl-cr);vh=ih*(1-ct-cb)
 if fit:
  scale=min(w/vw,h/vh);nw=vw*scale;nh=vh*scale;x+=(w-nw)/2;y+=(h-nh)/2;w,h=nw,nh
 sh=s.shapes.add_picture(str(file),Mm(x),Mm(y),width=Mm(w),height=Mm(h));sh.crop_left=cl;sh.crop_right=cr;sh.crop_top=ct;sh.crop_bottom=cb
 if link:sh.click_action.hyperlink.address=link
 # Use an unclipped original in both formats; only the viewport is cropped.
 fullw=w/(1-cl-cr);fullh=h/(1-ct-cb)
 c.saveState();clip=c.beginPath();clip.rect(x*U,(H-y-h)*U,w*U,h*U);c.clipPath(clip,stroke=0,fill=0)
 c.drawImage(ImageReader(im),(x-cl*fullw)*U,(H-y-fullh+ct*fullh)*U,width=fullw*U,height=fullh*U,mask='auto');c.restoreState()
 if link:c.linkURL(link,(x*U,(H-y-h)*U,(x+w)*U,(H-y)*U),relative=0)
 objects.append({'kind':'image','file':file.name,'x':x,'y':y,'w':w,'h':h});return sh

def heading(num,title,x,y,w=184):
 text(num,x,y,12,9,17,True,T);text(title,x+14,y,w-14,9,18,True,N);line(x,y+11,x+w,y+11)

def body(txt,x,y,w=184,h=24,size=14):return text(txt,x,y,w,h,size)
def badge(value,label,x,y,w=58):
 rect(x,y,w,19,PALE,radius=True);text(value,x+3,y+1,w-6,10,23,True,T,align='center');text(label,x+3,y+12,w-6,6,11,align='center')
def arrow(x,y,x2,y2):
 line(x,y,x2,y2,T,1.2);a=math.atan2(y2-y,x2-x)
 for da in [-.5,.5]:line(x2,y2,x2-2.6*math.cos(a+da),y2-2.6*math.sin(a+da),T,1.2)
def node(label,detail,x,y,w,h=17):
 rect(x,y,w,h,PALE,LINE,True);text(label,x+3,y+2,w-6,6,13,True,N,align='center');text(detail,x+3,y+9,w-6,h-9,10.5,color=MUT,align='center')
# Header: official source artwork / existing project identity.
rect(0,0,W,4,T)
picture(A/'charusat.png',12,9,94,22,fit=True)
if (A/'sfic.png').exists():picture(A/'sfic.png',493,7,89,28,fit=True)
else:
 text('SEVA FIRST',479,9,103,10,22,True,N,align='center');text('INNOVATION CHALLENGE',479,19,103,7,12,True,T,align='center');text('SFIC 2026 · Gujarat',479,27,103,5,10,align='center')
# Existing official web brand geometry: ellipse rotated -32 degrees and central disc.
# Coordinates preserve Brand.tsx geometry in a native, editable PowerPoint mark.
sh=s.shapes.add_shape(MSO_SHAPE.OVAL,Mm(243),Mm(15),Mm(14),Mm(6));sh.rotation=328;sh.fill.background();sh.line.color.rgb=RGBColor.from_string(N);sh.line.width=Pt(2.2)
c.saveState();c.translate(250*U,(H-18)*U);c.rotate(32);c.setStrokeColor(HexColor('#'+N));c.setLineWidth(2.2);c.ellipse(-7*U,-3*U,7*U,3*U,stroke=1,fill=0);c.restoreState()
sh=s.shapes.add_shape(MSO_SHAPE.OVAL,Mm(246.75),Mm(14.75),Mm(6.5),Mm(6.5));sh.fill.solid();sh.fill.fore_color.rgb=RGBColor.from_string(N);sh.line.fill.background();c.setFillColor(HexColor('#'+N));c.circle(250*U,(H-18)*U,3.25*U,fill=1,stroke=0)
text('VahakIN.',261,11,98,15,33,True,N)
text('Evidence-Led Vehicle Non-Use Monitoring',12,36,570,16,34,True,N,align='center')
text('Two ESP32-S3 devices for motion sensing, location sharing and RTO review',12,52,570,9,18,color=T,align='center')
text('Om Rashiya  •  Devanshi Patel  •  Aadya Raval  •  Lakshit Hirpara  •  Vaidehi Patel',12,63,570,7,15,True,align='center')
text('Team VahikIN.   |   Mentor: Prof Abhishek Patel   |   CSPIT, CHARUSAT   |   SFIC 2026 · PS000225 · TM002281',12,71,570,6,12.5,color=MUT,align='center')
line(12,81,582,81,T,1.5)
for x in [200.5,393.5]:line(x,86,x,352)
# LEFT COLUMN
x=12
heading('01','ABSTRACT & RESEARCH AIM',x,86)
body('VahakIN links declared Non-Use vehicles to reviewable motion and location evidence. Two hardware tiers share one owner-to-RTO workflow: claim a device, submit documents, verify dashboard mounting and inspect alerts. The prototype separates device motion from geographic displacement and preserves human review before any regulatory decision [1].',x,101,h=39,size=14)
text('Index Terms—ESP32-S3, IMU, GNSS, geofencing, Non-Use declarations.',x,133,184,8,10.5,italic=True,color=MUT)
heading('02','SYSTEM & WORKFLOW',x,144)
node('BASIC TRACKER','MPU-6050 + NEO-6M',x,159,88)
node('PLUS WATCH','QMI8658 + phone location',x+96,159,88)
arrow(x+44,176,x+44,181);arrow(x+140,176,x+140,181)
node('2.4 GHz HOTSPOT → LAPTOP','Signed IMU packets · Basic GNSS · separate consented phone fixes',x,182,184,19)
arrow(x+92,201,x+92,206)
node('NEXT.JS API + SUPABASE','Authentication · private evidence · device assignment · event history',x,207,184,19)
arrow(x+44,226,x+44,231);arrow(x+140,226,x+140,231)
node('OWNER WORKSPACE','Claim · upload · mount · share',x,232,88)
node('RTO WORKSPACE','Preview · decide · fence · review',x+96,232,88)
text('Claim → application → RTO review → dashboard confirmation → installation check → monitoring',x,253,184,13,12.5,True,T)
heading('03','HARDWARE & IMPLEMENTED FEATURES',x,271)
# compact comparison table
rows=[('Platform','Basic','Premium Plus'),('IMU / bus','MPU-6050 · SDA8/SCL9','QMI8658 · SDA15/SCL14'),('Location','NEO-6M · UART RX16','Owner phone browser [4]'),('Transport','Wi-Fi hotspot','Wi-Fi hotspot'),('Current scope','External IMU + GPS','Onboard IMU; no GPS/SIM')]
y=286; widths=[38,73,73]
for i,row in enumerate(rows):
 rect(x,y,184,8.7,N if i==0 else (PALE if i%2 else WHITE))
 offset=0
 for j,txt in enumerate(row):text(txt,x+offset+2,y+1.5,widths[j]-4,6,10.8,bold=i==0,color=WHITE if i==0 else INK);offset+=widths[j]
 y+=8.7
picture(A/'watch.jpg',x,332,36,25,fit=True)
body('Premium Plus · Waveshare ESP32-S3R8 [2], [3].\n2.06-inch AMOLED (410 × 502) and six-axis IMU. The demo uses sensing and Wi-Fi. Display and touch software are planned.',x+41,333,w=143,h=22,size=12)
# MIDDLE COLUMN
x=205
heading('04','SUSTAINED-MOTION METHOD',x,86)
body('50 Hz sampling · 5 s still calibration · 2 s rolling window. Trigger when ≥75/100 samples exceed 0.12 g dynamic acceleration OR 12°/s rotation. Re-arm after 5 s quiet.',x,101,h=23,size=14)
picture(A/'imu-plot.png',x,128,184,78.5)
text('Fig. 1. Software test with synthetic IMU inputs. The classifier rejects a 0.4 s bump and emits one event during sustained motion.',x,209,184,17,11.5,color=MUT)
heading('05','LOCATION & GEOFENCE LOGIC',x,230)
body('Basic: ≥5 satellites, HDOP ≤2.5. Plus: phone accuracy ≤30 m and explicit consent. Accept fresh fixes (≤15 s); confirm exits using two fixes 3–30 s apart beyond radius + buffer.',x,245,h=22,size=13.5)
picture(A/'location-plot.png',x,271,184,68.2)
text('Fig. 2. Simulated distance series for a 150 m fence with a 25 m buffer. Plus expands the buffer to reported accuracy and requires a fresh watch reading.',x,341,184,13,11.5,color=MUT)
# RIGHT COLUMN
x=398
heading('06','WORKING WEBSITE',x,86)
picture(A/'website-map.png',x,101,184,61.5,crop=(58,316,1382,759))
text('Fig. 3. Actual RTO map with demo markers. © OpenFreeMap / OpenMapTiles / OpenStreetMap. Markers represent fictional vehicles.',x,164,184,10,10.7,color=MUT)
picture(A/'website-plus.png',x,178,89,39,crop=(70,325,1370,895))
picture(A/'website-evidence.png',x+95,178,89,39,crop=(400,230,1360,650))
text('Owner: IMU + phone-sharing control',x,219,89,9,10.3,color=MUT)
text('RTO: private document preview',x+95,219,89,9,10.3,color=MUT)
heading('07','VALIDATION & RESOURCE USE',x,234)
badge('84 / 84','unit tests passed',x,249,58)
badge('7 / 8','browser audit passed',x+63,249,58)
badge('2 / 2','firmware builds passed',x+126,249,58)
picture(A/'memory-plot.png',x,272,184,34.8)
text('Fig. 4. Compiled image size / 1,310,720-byte app partition. Basic: 878,441 B; Plus: 870,137 B. Static RAM: 14% each.',x,309,184,11,10.5,color=MUT)
body('Latest Plus end-to-end reruns were blocked by login 503 / application timeout. Flashing and mounted vehicle trials are pending. Handling can also trigger a motion event.',x,324,h=16,size=12)
text('Next steps include mounted trials, false-alarm and battery measurements, and a complete Plus retest.',x,342,184,13,12,True,T)
# FOOTER: cross-cutting implementation + references + QR
line(12,359,582,359,T,1.4)
text('SECURITY & STACK',12,363,105,7,14,True,N)
text('HMAC-SHA256 • nonce replay checks • timestamp validation • private uploads • scoped owner/RTO access [5]\nArduino C++ / FreeRTOS · Next.js 15 · React 19 · TypeScript · Supabase / PostgreSQL · MapLibre · Vitest / Playwright',12,371,365,12,11.5)
text('SELECTED REFERENCES',12,386,110,6,11.5,True,N)
refs=[('[1] Team VahikIN., “PS000225 specification and implementation,” project repository, 2026.','https://github.com/rashiyaom/VahakIN.'),('[2] Waveshare, “ESP32-S3-Touch-AMOLED-2.06: board and QMI8658 examples,” 2026.','https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-2.06'),('[3] Espressif, “ESP32-S3 Series Datasheet,” ver. 2.2.','https://documentation.espressif.com/esp32-s3_datasheet_en.pdf'),('[4] W3C, “Geolocation,” Candidate Recommendation Draft, Nov. 18, 2026.','https://www.w3.org/TR/geolocation/'),('[5] Supabase, “Row Level Security,” developer documentation. Accessed Nov. 27, 2026.','https://supabase.com/docs/guides/database/postgres/row-level-security')]
for i,(txt,url) in enumerate(refs):text(txt,12,392+i*3.9,365,4.2,9.6,link=url)
for name,url,label,xq in [('github','https://github.com/rashiyaom/VahakIN.','SOURCE CODE',412),('research','https://drive.google.com/drive/folders/1QIngqlW2LFyZHwtl3ehswaF-s6ArddJZ?usp=sharing','RESEARCH MATERIAL',504)]:
 picture(A/(name+'-qr.png'),xq,365,36,36,link=url);text(label,xq-11,402,58,6,10.5,True,N,align='center')
text('SFIC 2026  /  27 NOV 2026  /  RESEARCH PROTOTYPE  /  A2 LANDSCAPE · 594 × 420 mm',12,411,570,4,8.5,color=MUT,align='center')
# Full provenance stored in editable slide notes.
s.notes_slide.notes_text_frame.text='''VahakIN research poster, generated 27 November 2026. A2 landscape 594 x 420 mm. Team spelling follows user: VahikIN.; project mark follows existing Brand.tsx: VahakIN.\nNo month-long testing, field accuracy, deployment or IEEE acceptance is claimed. IEEE-style numbered references; event-specific formatting must be checked separately.\nFig.1: synthetic 50 Hz input run through actual MotionDetector.h; CSV and plotting source supplied. Fig.2: illustrative distance series, not logged GPS. Fig.3 and thumbnails: actual website captures with fictional test data. Fig.4: compiler output from the most recent audit.\nEvidence: /tmp/ig-audit-unit.log (84 tests), /tmp/ig-audit-browser.log (7 pass/1 fail), /tmp/ig-audit-plus-retest.log (503), /tmp/ig-audit-plus-final.log (timeout), /tmp/ig-audit-basic.log and /tmp/ig-audit-plus.log.\nCHARUSAT logo: https://www.charusat.ac.in/_next/static/media/CHARUSAT_NEW.6cad095d.png\nSFIC logo artwork: https://www.educationpost.in/news/education/seva-first-innovation-challenge-opens-for-students-across-five-states-and-three-uts\nPlus hardware photo: https://www.waveshare.com/product/esp32-s3-touch-amoled-2.06.htm\nMap attribution retained. Drive QR is a user-supplied research folder, not a verified paper DOI. The connector showed no visible files; folder contents were not used as factual evidence.\nSources:\n'''+ '\n'.join(url for _,url in refs)
p.save(R/'VahakIN_A2_Research_Poster.pptx');c.showPage();c.save()
(R/'layout-audit.json').write_text(json.dumps({'page_mm':[W,H],'warnings':warnings,'objects':objects},indent=2))
doc=fitz.open(R/'VahakIN_A2_Research_Poster.pdf');page=doc[0];page.get_pixmap(matrix=fitz.Matrix(1.3,1.3),alpha=False).save(R/'VahakIN_A2_Preview.png')
print('Saved PPTX, PDF, preview. Layout warnings:',warnings)
