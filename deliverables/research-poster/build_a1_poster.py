"""Generate editable A1 landscape PPTX plus a matching print PDF; dimensions are millimetres."""
from pathlib import Path
import math,json
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
R=Path(__file__).parent
A=R/'assets'
# Logical grid stays familiar while the media boxes use exact ISO A1 dimensions.
W,H=594,420
PW,PH=841,594
SX,SY=PW/W,PH/H
U=72/25.4
def mx(value): return Mm(value*SX)
def my(value): return Mm(value*SY)
N='163446';T='087F83';INK='233743';MUT='526773';LINE='D5E0E4';PALE='F0F6F7';WHITE='FFFFFF';AMBER='A56016'
for n,f in [('Arial','Arial.ttf'),('Arial-Bold','Arial Bold.ttf'),('Arial-Italic','Arial Italic.ttf')]:pdfmetrics.registerFont(TTFont(n,'/System/Library/Fonts/Supplemental/'+f))
p=Presentation();p.slide_width=Mm(PW);p.slide_height=Mm(PH);s=p.slides.add_slide(p.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string(WHITE)
c=canvas.Canvas(str(R/'VahakIN_A1_Research_Poster.pdf'),pagesize=(PW*U,PH*U));c.setTitle('VahakIN — A1 Research Poster');c.setAuthor('Team VahikIN. | CSPIT, CHARUSAT')
c.scale(SX,SY)
objects=[];warnings=[]
def rect(x,y,w,h,fill=WHITE,line=None,radius=False):
 sh=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,mx(x),my(y),mx(w),my(h));sh.fill.solid();sh.fill.fore_color.rgb=RGBColor.from_string(fill)
 if line:sh.line.color.rgb=RGBColor.from_string(line);sh.line.width=Pt(.65*SX)
 else:sh.line.fill.background()
 if radius:
  try:sh.adjustments[0]=.08
  except:pass
 c.setFillColor(HexColor('#'+fill));c.setStrokeColor(HexColor('#'+(line or fill)));c.setLineWidth(.65)
 if radius:c.roundRect(x*U,(H-y-h)*U,w*U,h*U,2*U,fill=1,stroke=int(bool(line)))
 else:c.rect(x*U,(H-y-h)*U,w*U,h*U,fill=1,stroke=int(bool(line)))
 return sh

def line(x,y,x2,y2,color=LINE,width=.7):
 sh=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,mx(x),my(y),mx(x2),my(y2));sh.line.color.rgb=RGBColor.from_string(color);sh.line.width=Pt(width*SX)
 c.setStrokeColor(HexColor('#'+color));c.setLineWidth(width);c.line(x*U,(H-y)*U,x2*U,(H-y2)*U)

def text(txt,x,y,w,h,size=14,bold=False,color=INK,align='left',italic=False,link=None):
 font='Arial-Bold' if bold else 'Arial-Italic' if italic else 'Arial';leading=size*1.18
 lines=[]
 for paragraph in txt.split('\n'):lines+=simpleSplit(paragraph,font,size,w*U) or ['']
 if len(lines)*leading>h*U+.5:warnings.append(f'Text overflow {txt[:48]}: {len(lines)*leading/U:.1f}>{h}mm')
 box=s.shapes.add_textbox(mx(x),my(y),mx(w),my(h));tf=box.text_frame;tf.clear();tf.word_wrap=False;tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0;tf.vertical_anchor=MSO_ANCHOR.TOP
 for i,L in enumerate(lines):
  par=tf.paragraphs[0] if i==0 else tf.add_paragraph();par.text=L;par.font.name='Arial';par.font.size=Pt(size*SY);par.font.bold=bold;par.font.italic=italic;par.font.color.rgb=RGBColor.from_string(color);par.space_after=Pt(0);par.space_before=Pt(0);par.line_spacing=Pt(leading*SY);par.alignment={'left':PP_ALIGN.LEFT,'center':PP_ALIGN.CENTER,'right':PP_ALIGN.RIGHT}[align]
  if link and par.runs:par.runs[0].hyperlink.address=link
  c.setFont(font,size);c.setFillColor(HexColor('#'+color));baseline=(H-y)*U-size-i*leading
  if align=='center':c.drawCentredString((x+w/2)*U,baseline,L)
  elif align=='right':c.drawRightString((x+w)*U,baseline,L)
  else:c.drawString(x*U,baseline,L)
 if link:c.linkURL(link,(x*U,(H-y-h)*U,(x+w)*U,(H-y)*U),relative=1)
 objects.append({'kind':'text','text':txt,'x':x,'y':y,'w':w,'h':h,'size':size});return box

def picture(file,x,y,w,h,crop=None,fit=False,link=None):
 file=Path(file);im=Image.open(file);iw,ih=im.size
 if crop:
  l,t,r,b=crop;cl=l/iw;cr=(iw-r)/iw;ct=t/ih;cb=(ih-b)/ih
 else:cl=cr=ct=cb=0
 vw=iw*(1-cl-cr);vh=ih*(1-ct-cb)
 if fit:
  scale=min(w/vw,h/vh);nw=vw*scale;nh=vh*scale;x+=(w-nw)/2;y+=(h-nh)/2;w,h=nw,nh
 sh=s.shapes.add_picture(str(file),mx(x),my(y),width=mx(w),height=my(h));sh.crop_left=cl;sh.crop_right=cr;sh.crop_top=ct;sh.crop_bottom=cb
 if link:sh.click_action.hyperlink.address=link
 # Use an unclipped original in both formats; only the viewport is cropped.
 fullw=w/(1-cl-cr);fullh=h/(1-ct-cb)
 c.saveState();clip=c.beginPath();clip.rect(x*U,(H-y-h)*U,w*U,h*U);c.clipPath(clip,stroke=0,fill=0)
 c.drawImage(ImageReader(im),(x-cl*fullw)*U,(H-y-fullh+ct*fullh)*U,width=fullw*U,height=fullh*U,mask='auto');c.restoreState()
 if link:c.linkURL(link,(x*U,(H-y-h)*U,(x+w)*U,(H-y)*U),relative=1)
 objects.append({'kind':'image','file':file.name,'x':x,'y':y,'w':w,'h':h});return sh

def heading(num,title,x,y,w=184):
 text(num,x,y,12,9,17,True,T);text(title,x+14,y,w-14,9,18,True,N);line(x,y+11,x+w,y+11)

def body(txt,x,y,w=184,h=24,size=14):return text(txt,x,y,w,h,size)
def arrow(x,y,x2,y2):
 line(x,y,x2,y2,T,1.2);a=math.atan2(y2-y,x2-x)
 for da in [-.5,.5]:line(x2,y2,x2-2.6*math.cos(a+da),y2-2.6*math.sin(a+da),T,1.2)
def node(label,detail,x,y,w,h=17):
 rect(x,y,w,h,PALE,LINE,True);text(label,x+3,y+2,w-6,6,13,True,N,align='center');text(detail,x+3,y+9,w-6,h-9,10.5,color=MUT,align='center')
# Header
rect(0,0,W,3,T)
picture(A/'charusat.png',12,9,94,22,fit=True)
picture(A/'sfic.png',493,7,89,28,fit=True)
mark=s.shapes.add_shape(MSO_SHAPE.OVAL,mx(243),my(15),mx(14),my(6))
mark.rotation=328
mark.fill.background()
mark.line.color.rgb=RGBColor.from_string(N)
mark.line.width=Pt(2.2*SX)
c.saveState();c.translate(250*U,(H-18)*U);c.rotate(32)
c.setStrokeColor(HexColor('#'+N));c.setLineWidth(2.2);c.ellipse(-7*U,-3*U,7*U,3*U,stroke=1,fill=0);c.restoreState()
disc=s.shapes.add_shape(MSO_SHAPE.OVAL,mx(246.75),my(14.75),mx(6.5),my(6.5))
disc.fill.solid();disc.fill.fore_color.rgb=RGBColor.from_string(N);disc.line.fill.background()
c.setFillColor(HexColor('#'+N));c.circle(250*U,(H-18)*U,3.25*U,fill=1,stroke=0)
text('VahakIN.',261,11,98,15,33,True,N)
text('Evidence-Led Vehicle Non-Use Monitoring',12,32,570,16,34,True,N,align='center')
text('Device-side sensing and location, RTO review, and Gujarat vehicle tax decision support',12,48,570,9,17,color=T,align='center')
text('Om Rashiya  •  Devanshi Patel  •  Aadya Raval  •  Lakshit Hirpara  •  Vaidehi Patel',12,59,570,7,15,True,align='center')
text('Team VahikIN.   |   Mentor: Prof Abhishek Patel   |   CSPIT, CHARUSAT   |   SFIC 2026 · PS000225 · TM002281',12,67,570,6,12.5,color=MUT,align='center')
line(12,77,582,77,T,1.3)
for x in (200.5,393.5):line(x,82,x,370)

# Column 1 — hardware and statutory workflow
x=12
heading('01','ABSTRACT & DESIGN GOAL',x,82)
body('VahakIN supports owners and Regional Transport Offices (RTOs) in monitoring vehicles declared Non-Use. Both device designs capture motion and geographic position on the vehicle. The website links that evidence to the declaration, owner explanations, and an independent review of any proposed tax assessment [1].',x,96,h=33,size=13.4)
text('Index terms — ESP32-S3, GNSS, inertial sensing, geofencing, vehicle taxation.',x,130,184,7,10.5,italic=True,color=MUT)
heading('02','AUTONOMOUS DEVICE DESIGN',x,141)
rows=[('Component','Basic tracker','Premium Plus watch'),('Controller','ESP32-S3','Waveshare ESP32-S3R8'),('Motion','MPU-6050 over I²C','Onboard QMI8658 over I²C'),('Position','Device NEO-6M GNSS','Watch-attached GNSS planned'),('Uplink','Wi-Fi demo, modem planned','Watch-attached modem planned')]
y=155
widths=[33,74,77]
for i,row in enumerate(rows):
 rect(x,y,184,9.1,N if i==0 else PALE if i%2 else WHITE)
 offset=0
 for j,entry in enumerate(row):
  text(entry,x+offset+2,y+1.6,widths[j]-4,6.4,10.9,i==0,WHITE if i==0 else INK)
  offset+=widths[j]
 y+=9.1
body('Target operation. Basic obtains its own location from NEO-6M. Plus will obtain its own location from a GNSS module fitted to the watch. Each unit samples, timestamps, buffers and uploads evidence through its own network interface. The target workflow requires no owner handset [1]–[3].',x,203,h=29,size=12.7)
text('Build status · Basic GNSS firmware is implemented. Plus IMU firmware is implemented and its GNSS/modem integration is planned.',x,233,184,11,10.6,italic=True,color=MUT)
heading('03','GUJARAT NON-USE & TAX',x,248)
body('Form NT records the reason, period and garage address under Rule 5 [5]. Section 3(2) ties Non-Use recognition to certification by the Taxation Authority. The portal separates application review, certification status and movement requests [4], [5].',x,262,h=24,size=12.5)
body('The calculator selects a rule by vehicle class, jurisdiction and assessable period, then computes the estimate in whole paise. Distance and travel time inform the investigation. The notified schedule and applicable period determine the base tax [1], [4].',x,288,h=24,size=12.5)
rect(x,315,184,25,PALE,LINE,True)
text('ILLUSTRATIVE TAX REVIEW  /  DEMO',x+4,317,176,6,10.5,True,T)
text('INR 6,000 base + 12,000 penalty = 18,000',x+4,324,176,9,16,True,N)
text('Illustrative base and potential 2× penalty under §18(1A) [4].',x+4,333,176,5.5,10.5,color=MUT)
body('Section 18(1B) prevents stacking §18(1) and §18(1A) penalties. The demo requests an owner explanation before an independent decision. Official assessments require verified rates and an authorized Taxation Authority [1], [4].',x,344,h=25,size=12)

# Column 2 — methods and illustrations
x=205
heading('04','MOTION CLASSIFICATION',x,82)
body('Sample at 50 Hz and calibrate for 5 s while still. In each 2 s window, require 75 of 100 samples at or above 0.12 g of dynamic acceleration or 12°/s of rotation. Re-arm after 5 s of quiet.',x,96,h=22,size=13.2)
picture(A/'imu-plot.png',x,121,184,78.5)
text('Fig. 1. Software test with synthetic IMU inputs. A short bump is rejected and sustained motion emits one event.',x,201,184,12,11,color=MUT)
heading('05','LOCATION & GEOFENCE',x,219)
body('Each target device supplies GNSS fixes. Basic qualifies fixes with at least five satellites, HDOP ≤2.5 and age ≤15 s. Two accepted fixes 3–30 s apart beyond the configured radius plus 25 m confirm a Basic geofence exit.',x,233,h=24,size=13.1)
picture(A/'location-plot.png',x,262,184,68.2)
text('Fig. 2. Simulated distance from the parking centre. A 150 m radius plus a 25 m buffer gives a 175 m exit threshold.',x,332,184,11,11,color=MUT)
rect(x,346,184,22,PALE,LINE,True)
text('HOW RTO STAFF USE A SIGNAL',x+4,348,176,7,11.5,True,T)
body('Motion can come from handling. GNSS drift can place a stationary device near a boundary. Staff review the observations, permission record and owner explanation before deciding the case.',x+4,355,w=176,h=12,size=10.8)

# Column 3 — actual screens and an editable website module flowchart.
x=398
heading('06','WEBSITE SCREENS',x,82)
picture(A/'website-map.png',x,96,184,61.5,crop=(58,316,1382,759))
text('Fig. 3. RTO location monitoring in Rajkot with demo markers. Map data © OpenStreetMap contributors. OpenFreeMap / OpenMapTiles.',x,159,184,11,10.3,color=MUT)
picture(A/'website-evidence.png',x,173,89,33,crop=(398,228,1374,590))
picture(A/'website-tax.png',x+95,173,89,33,crop=(55,149,1385,642))
text('Applications · private evidence preview',x,208,89,8,10.2,color=MUT)
text('Financial intelligence · Tax Review',x+95,208,89,8,10.2,color=MUT)
heading('07','WEBSITE MODULE FLOW',x,220)
# The entry points converge on the registry and continue through authorized review.
node('OWNER WORKSPACE','Overview · Applications · device claim\nMy vehicles · mounting confirmation\nCompliance & Tax',x,234,88,22)
node('DEVICE TELEMETRY','Signed motion + device GNSS\nDevice health · Hardware simulator',x+96,234,88,22)
line(x+44,256,x+44,259,T,1.2);line(x+140,256,x+140,259,T,1.2)
line(x+44,259,x+140,259,T,1.2);arrow(x+92,259,x+92,263)
node('RTO APPLICATIONS & REGISTRY','Document preview · Vehicle registry · Non-Use declarations',x,264,184,18)
arrow(x+92,282,x+92,287)
node('LOCATION MONITORING','Parking geofence · Alerts & events · Movement requests',x,288,184,18)
arrow(x+92,306,x+92,311)
node('INVESTIGATIONS → FINANCIAL INTELLIGENCE','Evidence review → calculation → owner response → decision',x,312,184,18)
arrow(x+92,330,x+92,335)
node('ADMINISTRATION & OVERSIGHT','Tax rule registry · Revenue intelligence\nReports & exports · Audit trail · Team & access\nStates & territories · RTO offices',x,336,184,23)
text('Shared services   /   Next.js API · Supabase and PostgreSQL\nPrivate documents · Role-based access · Signed event history [6]',x,362,184,10,10.4,True,T,align='center')

# Footer — readable references and scannable codes.
line(12,375,582,375,T,1.3)
text('SELECTED REFERENCES',12,379,184,6,11.7,True,N)
refs=[
 ('[1] Team VahikIN., “PS000225 requirements, implementation and demo tax methodology,” project repository, 2026.','https://github.com/rashiyaom/VahakIN.'),
 ('[2] Waveshare, “ESP32-S3-Touch-AMOLED-2.06,” board documentation and examples.','https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-2.06'),
 ('[3] Espressif Systems, “ESP32-S3 Series Datasheet,” ver. 2.2.','https://documentation.espressif.com/esp32-s3_datasheet_en.pdf'),
 ('[4] Government of Gujarat, Gujarat Motor Vehicles Tax Act, 1958, §§ 3 and 18, India Code.','https://www.indiacode.nic.in/bitstream/123456789/4580/1/motorvehiclestaxact.pdf'),
 ('[5] Government of Gujarat, Bombay Motor Vehicles Tax Rules, 1959, Rule 5 and Form NT, India Code.','https://upload.indiacode.nic.in/showfile?actid=AC_GJ_66_317_00005_00005_1543661645124&filename=bombay_motor_vehicle_tax_rules-1959.pdf&type=rule'),
 ('[6] Supabase, “Row Level Security,” developer documentation.','https://supabase.com/docs/guides/database/postgres/row-level-security'),
]
for i,(label,url) in enumerate(refs):text(label,12,386+i*4.1,376,4.2,9.8,link=url)
repo='https://github.com/rashiyaom/VahakIN.'
research='https://drive.google.com/drive/folders/1QIngqlW2LFyZHwtl3ehswaF-s6ArddJZ?usp=sharing'
for asset,url,label,qx in [('github',repo,'SOURCE CODE',422),('research',research,'RESEARCH MATERIAL',514)]:
 picture(A/f'{asset}-qr.png',qx,377,29,29,link=url);text(label,qx-14.5,407,58,5.5,10,True,N,align='center')
text('SFIC 2026  /  27 NOV 2026  /  RESEARCH PROTOTYPE  /  A1 LANDSCAPE · 841 × 594 mm',12,413,570,4.4,8.7,color=MUT,align='center')

s.notes_slide.notes_text_frame.text=('''A1 landscape, 841 × 594 mm. Website figures show the working prototype with fictional records. The autonomous device panel is the target design. The current Basic implementation uses NEO-6M over Wi-Fi. Plus integrates a QMI8658 IMU and presently demonstrates location via browser consent. Device-mounted GNSS and modem integration are planned for Plus. Standalone cellular upload has not been demonstrated. The IMU plot uses synthetic samples passed through the actual firmware classifier. Geofence series is illustrative. The tax panel describes the demo workflow and an assumed ₹6,000 assessable base. The active statutory rates and authority decisions remain outside the prototype.\nLogo sources and links:\nhttps://www.charusat.ac.in/\nhttps://www.educationpost.in/news/education/seva-first-innovation-challenge-opens-for-students-across-five-states-and-three-uts\n'''+ '\n'.join(url for _,url in refs))
if warnings:raise ValueError('\n'.join(warnings))
pptx=R/'VahakIN_A1_Research_Poster.pptx'
pdf=R/'VahakIN_A1_Research_Poster.pdf'
p.save(pptx);c.showPage();c.save()
(R/'a1-layout-audit.json').write_text(json.dumps({'page_mm':[PW,PH],'warnings':warnings,'objects':objects},indent=2))
with fitz.open(pdf) as document:
 document[0].get_pixmap(matrix=fitz.Matrix(1,1),alpha=False).save(R/'VahakIN_A1_Preview.png')
print('Saved editable A1 PPTX and matching PDF. No layout warnings.')
