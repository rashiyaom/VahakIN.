"""Print-ready handout and six tabletop cards for the VahakIN exhibition."""
from pathlib import Path
import math
import zipfile
import fitz
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit
import matplotlib

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT.parent / 'research-poster/assets'
POINTS = 72 / 25.4
NAVY, TEXT, MUTED = '#102737', '#1A3340', '#50656D'
LIME, TEAL, PAPER, WHITE = '#E0F576', '#006D66', '#F7F8F1', '#FFFFFF'
LINE, PALE, WARM = '#D7E0D8', '#EBF2E9', '#F8EDD9'
REPO = 'https://github.com/rashiyaom/VahakIN.'
RESEARCH = 'https://drive.google.com/drive/folders/1QIngqlW2LFyZHwtl3ehswaF-s6ArddJZ?usp=sharing'
ACT = 'https://www.indiacode.nic.in/bitstream/123456789/4580/1/motorvehiclestaxact.pdf'
RULES = 'https://upload.indiacode.nic.in/showfile?actid=AC_GJ_66_317_00005_00005_1543661645124&filename=bombay_motor_vehicle_tax_rules-1959.pdf&type=rule'
FONT = Path(matplotlib.get_data_path())/'fonts/ttf'
for name, file in [('Regular','DejaVuSans.ttf'), ('Bold','DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT/file)))

class Page:
    def __init__(self, cv, w, h, x=0, y=0):
        self.c, self.w, self.h = cv, w, h
        cv.saveState()
        cv.translate(x*POINTS,y*POINTS)
        cv.scale(POINTS,POINTS)

    def end(self):
        self.c.restoreState()

    def box(self,x,y,w,h,fill,stroke=None,radius=0):
        c=self.c
        c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(stroke or fill)); c.setLineWidth(.25)
        c.roundRect(x,self.h-y-h,w,h,radius,stroke=int(bool(stroke)),fill=1)

    def line(self,x1,y1,x2,y2,color=LINE,width=.35,dash=None):
        c=self.c; c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.setDash(dash or [])
        c.line(x1,self.h-y1,x2,self.h-y2);c.setDash([])

    def dot(self,x,y,r,fill,stroke=None):
        c=self.c;c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke or fill));c.setLineWidth(.35)
        c.circle(x,self.h-y,r,stroke=int(bool(stroke)),fill=1)

    def ring(self,x,y,r,color,width=.4,dash=None):
        c=self.c;c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.setDash(dash or [])
        c.circle(x,self.h-y,r,stroke=1,fill=0);c.setDash([])

    def text(self,txt,x,y,w,size=10,bold=False,color=TEXT,align='left',max_h=None,link=None):
        c=self.c;f='Bold' if bold else 'Regular';lead=size*1.20/POINTS
        rows=[]
        for block in txt.split('\n'):rows+=simpleSplit(block,f,size,w*POINTS) or ['']
        if max_h is not None and len(rows)*lead>max_h+.05:
            raise ValueError(f'Overflow {txt!r}: {len(rows)*lead:.1f} mm > {max_h} mm')
        c.setFillColor(HexColor(color));c.setFont(f,size/POINTS)
        for i,row in enumerate(rows):
            base=self.h-y-size/POINTS-i*lead
            if align=='center':c.drawCentredString(x+w/2,base,row)
            elif align=='right':c.drawRightString(x+w,base,row)
            else:c.drawString(x,base,row)
        if link:c.linkURL(link,(x,self.h-y-len(rows)*lead,x+w,self.h-y),relative=1)
        return len(rows)*lead

    def arrow(self,x,y,a,b,color=TEAL,width=.6):
        self.line(x,y,a,b,color,width)
        theta=math.atan2(b-y,a-x)
        for offset in (-.52,.52):
            self.line(a,b,a-2.1*math.cos(theta+offset),b-2.1*math.sin(theta+offset),color,width)

    def brand(self,x,y,color=NAVY):
        c=self.c;c.saveState();c.translate(x+3.6,self.h-y-3.5);c.rotate(32)
        c.setStrokeColor(HexColor(color));c.setLineWidth(.55);c.ellipse(-4.2,-1.8,4.2,1.8,stroke=1,fill=0)
        c.setFillColor(HexColor(color));c.circle(0,0,1.65,stroke=0,fill=1);c.restoreState()
        self.text('VahakIN.',x+9,y,42,14,True,color,max_h=7)

    def img(self,file,x,y,w,h,link=None):
        self.c.drawImage(str(file),x,self.h-y-h,w,h,mask='auto')
        if link:self.c.linkURL(link,(x,self.h-y-h,x+w,self.h-y),relative=1)

    def car(self,x,y,scale=1,body=TEAL,wheel=NAVY):
        self.box(x,y+3*scale,16*scale,6*scale,body,radius=1.5*scale)
        self.box(x+3*scale,y,10*scale,5*scale,body,radius=1.4*scale)
        self.box(x+4.6*scale,y+1.0*scale,6.8*scale,2.1*scale,WHITE,radius=.45*scale)
        for offset in (3.5,12.5):self.dot(x+offset*scale,y+9*scale,1.35*scale,wheel)


def front(p):
    p.box(0,0,148,210,PAPER)
    p.box(0,0,148,4,LIME)
    p.brand(9,9)
    p.text('SFIC 2026  /  PS000225',92,10,47,9,True,TEAL,align='right')
    p.text('When a parked\nvehicle moves',9,24,130,32,True,NAVY,max_h=29)
    p.text('VahakIN helps owners and Rajkot RTO review possible misuse of vehicles declared Non-Use.',9,55,128,12.5,max_h=14)

    p.box(9,72,130,47,NAVY,radius=3)
    # A parking circle, an IMU pulse and a reviewable event.
    for r,style in [(15,[1.1,1.3]),(11,None)]:p.ring(31,95,r,LIME,.35,style)
    p.car(24,91,.86,LIME,NAVY)
    p.arrow(51,95,61,95,LIME)
    wave=[(65,96),(70,96),(73,88),(76,102),(79,91),(82,96),(88,96)]
    for a,b in zip(wave,wave[1:]):p.line(*a,*b,LIME,.65)
    p.arrow(93,95,103,95,LIME)
    p.box(110,85,17,19,WHITE,radius=1.4)
    for yy in (90,94,98):p.line(113,yy,124,yy,TEAL,.6)
    for x,label in [(11,'PARKING AREA'),(56,'MOTION SIGNAL'),(101,'RTO REVIEW')]:
        p.text(label,x,110,41,7.6,True,WHITE,'center',max_h=5)

    p.text('TWO DEVICES. ONE WORKFLOW.',9,125,130,10.4,True,TEAL,max_h=6)
    data=[(9,'BASIC','₹1,800','MPU-6050 motion sensor\nNEO-6M device GNSS'),(76,'PREMIUM PLUS','₹3,400','QMI8658 watch IMU\nWatch-mounted GNSS*')]
    for x,name,price,details in data:
        p.box(x,133,63,34,WHITE,LINE,2.5)
        p.text(name,x+4,136,55,8.1,True,TEAL,max_h=5)
        p.text(price,x+4,141,55,20,True,NAVY,max_h=10)
        p.text(details,x+4,151,55,9.4,max_h=11)
    p.text('Both designs capture and send data on the device. No owner phone required. *Plus GNSS and standalone cellular uplink are planned.',9,171,130,9.1,color=MUTED,max_h=13)
    p.line(9,185,139,185)
    p.text('TEAM VAHIKIN. · TM002281',9,188,130,9.3,True,NAVY,max_h=5)
    p.text('Om Rashiya · Devanshi Patel · Aadya Raval · Lakshit Hirpara · Vaidehi Patel',9,193,130,8.25,max_h=10)
    p.text('Mentor  Prof. Abhishek Patel  /  CSPIT, CHARUSAT',9,201,130,8.2,color=MUTED,max_h=5)


def puzzle_table(p,x,y):
    specs=[('A','0 s','142 m','Yes'),('B','5 s','184 m','No'),('C','10 s','171 m','Yes'),('D','15 s','183 m','Yes'),('E','20 s','192 m','Yes')]
    p.box(x,y,130,8,NAVY,radius=1)
    for a,b in [(4,'FIX'),(27,'TIME'),(56,'FROM CENTRE'),(102,'VALID FIX?')]:p.text(b,x+a,y+1.8,35,8,True,WHITE,max_h=5)
    for i,row in enumerate(specs):
        yy=y+8+i*7.2
        p.box(x,yy,130,7.2,WHITE if i%2==0 else PALE,LINE)
        for j,(a,value) in enumerate(zip([4,27,56,102],row)):
            p.text(value,x+a,yy+1,26,9.9,j==0,TEAL if j==0 else TEXT,max_h=5)


def back(p):
    p.box(0,0,148,210,WHITE)
    p.box(0,0,148,4,LIME)
    p.brand(9,9)
    p.text('THE 30-SECOND CASE',92,10,47,9,True,TEAL,align='right')
    p.text('Circle the first exit.',9,23,130,24,True,NAVY,max_h=13)
    p.text('You’re the reviewer. The parking radius is 150 m and the buffer is 25 m. Which fix first confirms an exit?',9,37,130,11.5,max_h=15)
    p.box(9,54,130,16,PALE,radius=2)
    p.text('THE RULE',13,56,32,8.8,True,TEAL,max_h=6)
    p.text('Find two consecutive valid fixes beyond 175 m, taken 3–30 seconds apart.',45,56,89,9.5,max_h=12)
    puzzle_table(p,9,74)
    p.text('Your pick   A   /   B   /   C   /   D   /   E',9,121,130,10.4,True,TEAL,max_h=6)
    p.text('Bonus: what record would you check before opening a tax assessment?',9,129,130,9.8,max_h=7)

    p.line(9,140,139,140)
    p.text('FROM FORM NT TO TAX REVIEW',9,144,130,10,True,NAVY,max_h=6)
    p.text('Declare the period and garage address. Review the certified period, movement permission and owner response. The demo estimates tax using the vehicle class and an applicable rule.',9,151,130,9.6,max_h=14)
    p.text('Demo example  ·  ₹6,000 base + ₹12,000 potential penalty = ₹18,000.',9,165,130,8.9,True,max_h=7)
    p.text('India Code · Gujarat Tax Act §§ 3, 18',9,172,68,7.4,color=TEAL,link=ACT,max_h=7)
    p.text('Rule 5 · Form NT',81,172,58,7.4,color=TEAL,link=RULES,max_h=6)

    p.img(ASSETS/'github-qr.png',9,179,20,20,REPO)
    p.img(ASSETS/'research-qr.png',39,179,20,20,RESEARCH)
    p.text('Code',9,200,20,8.5,True,TEAL,'center',max_h=5)
    p.text('Research',39,200,20,8.5,True,TEAL,'center',max_h=5)
    p.box(68,180,71,23,NAVY,radius=2)
    # An upside-down answer invites visitors to finish the puzzle before reading it.
    p.c.saveState();p.c.translate(203,2*p.h-383);p.c.rotate(180)
    p.text('ANSWER: E (20 s). D and E qualify. Bonus: check any movement permission and the certified declaration period.',72,183,63,8.15,True,WHITE,max_h=17)
    p.c.restoreState()


def tabletop_card(p,index,kicker,title,story,detail,art):
    p.box(0,0,148,105,PAPER,LINE)
    p.box(0,0,148,3,LIME)
    p.brand(7,7)
    p.text(f'FIELD NOTES    {index:02d} / 06',94,8,47,8.5,True,TEAL,'right',max_h=5)
    p.text(kicker,7,20,134,8.2,True,TEAL,max_h=5)
    p.text(title,7,25,134,20,True,NAVY,max_h=17)
    p.box(7,45,54,43,NAVY,radius=2.4)
    art(p)
    p.text(story,66,45,74,11.1,True,NAVY,max_h=19)
    p.text(detail,66,66,74,9.6,max_h=23)
    p.line(7,92,141,92)
    p.text('PS000225  /  COLLECTOR OFFICE, RAJKOT   •   CSPIT, CHARUSAT',7,96,134,7.7,color=MUTED,max_h=5)


def art_context(p):
    p.ring(34,65,15,LIME,.45,[1.3,1.3]);p.car(26,59,1,LIME,NAVY)
    p.text('DECLARED NON-USE',10,80,48,7.0,True,WHITE,'center',max_h=5)


def art_devices(p):
    p.box(14,54,18,17,LIME,radius=1.3);p.box(39,52,13,21,LIME,radius=2.4)
    p.box(41,56,9,13,NAVY,radius=1.2)
    for r in [2,3.4]:p.ring(46,62,r,LIME,.3)
    for x,name in [(11,'BASIC'),(34,'PLUS')]:p.text(name,x,76,24,8.2,True,WHITE,'center',max_h=5)


def art_motion(p):
    for y in (55,61,67,73):p.line(12,y,56,y,'#47616C',.25)
    pts=[(12,69),(18,69),(19,56),(21,69),(29,69),(31,57),(34,65),(37,53),(40,65),(43,56),(46,69),(56,69)]
    for a,b in zip(pts,pts[1:]):p.line(*a,*b,LIME,.55)
    p.text('50 SAMPLES / SECOND',9,79,50,7.5,True,WHITE,'center',max_h=5)


def art_queue(p):
    for i in range(3):
        yy=53+i*7
        p.box(13,yy,22,5,WHITE,radius=.7);p.dot(16,yy+2.5,1,LIME);p.line(20,yy+2.5,32,yy+2.5,TEAL,.45)
    p.arrow(39,63,53,63,LIME)
    p.text('SAVE → RETRY',10,78,48,8.5,True,WHITE,'center',max_h=5)


def art_fence(p):
    p.ring(29,66,13,LIME,.4,[1.2,1.4]);p.ring(29,66,10,WHITE,.35)
    p.dot(29,66,1.2,WHITE)
    coords=[(29,66),(36,68),(44,62),(53,54)]
    for a,b in zip(coords,coords[1:]):p.arrow(*a,*b,WHITE,.45)
    for x,y in coords[1:]:p.dot(x,y,1.3,LIME)
    p.text('RADIUS + BUFFER',10,79,48,7.7,True,WHITE,'center',max_h=5)


def art_tax(p):
    p.text('₹6,000',11,52,46,14,True,WHITE,'center',max_h=7)
    p.text('+ ₹12,000',11,62,46,13,True,WHITE,'center',max_h=7)
    p.line(18,71,50,71,LIME,.5)
    p.text('₹18,000',11,73,46,15,True,LIME,'center',max_h=8)


CARDS=[
 ('THE PROBLEM','Why watch a parked vehicle?', 'Non-Use declarations cover vehicles kept off the road for a declared period.', 'A vehicle may be at a private garage or depot. Location and motion evidence give owners and RTO staff a way to review suspected use without requiring a shared parking yard.',art_context),
 ('HARDWARE & PRICE','The device does the work.', 'Basic ₹1,800\nPremium Plus ₹3,400', 'Basic uses NEO-6M GNSS. Plus pairs an onboard watch IMU with a planned watch-mounted GNSS module. Both target autonomous capture and upload. Standalone modems are planned.',art_devices),
 ('MOTION FILTER','A bump is easy to pick up.', 'The classifier looks for motion that persists.', 'It samples at 50 Hz and requires at least 1.5 seconds of activity in a 2-second window. A short bump can exceed the threshold and still fail the duration check.',art_motion),
 ('CONNECTIVITY','What if the signal drops?', 'A device can save motion events for later delivery.', 'The prototype queues up to eight unacknowledged motion events and retries signed uploads after reconnection. The dashboard makes gaps in fresh location data visible.',art_queue),
 ('PARKING GEOFENCE','Why add a 25 m buffer?', 'A position near the line can come from GNSS drift.', 'Basic checks quality and asks for two fresh observations beyond the radius plus buffer. The gap between them must be 3–30 seconds. Try this rule in the handout puzzle.',art_fence),
 ('TAX & EVIDENCE','From observation to review.', 'Form NT states the period and where the vehicle is kept.', 'Staff can check a movement permission and request an owner explanation. The tax figure shown uses a fictional ₹6,000 base and an illustrative 2× penalty scenario.',art_tax),
]


def pdf(name,width,height):
    c=canvas.Canvas(str(ROOT/name),pagesize=(width*POINTS,height*POINTS),pageCompression=1)
    c.setTitle(name.replace('_',' ').removesuffix('.pdf'));c.setAuthor('Team VahikIN. · CSPIT, CHARUSAT');return c


def make():
    handout=pdf('VahakIN_A5_Duplex_Handout.pdf',148,210)
    for side in (front,back):
        p=Page(handout,148,210);side(p);p.end();handout.showPage()
    handout.save()

    cards=pdf('VahakIN_A6_Tabletop_Cards.pdf',148,105)
    sheets=pdf('VahakIN_A4_Tabletop_Print_Sheets.pdf',210,297)
    for index,values in enumerate(CARDS,1):
        p=Page(cards,148,105);tabletop_card(p,index,*values);p.end();cards.showPage()
        # Two A6 cards on an A4 sheet with space around each for trim marks.
        left=31; bottom=160 if index%2 else 32
        p=Page(sheets,148,105,left,bottom);tabletop_card(p,index,*values);p.end()
        p=Page(sheets,210,297);top=297-bottom-105
        for x,sign in [(left,-1),(left+148,1)]:
            for y,ysign in [(top,-1),(top+105,1)]:
                p.line(x+sign*1.5,y,x+sign*5,y,MUTED,.22);p.line(x,y+ysign*1.5,x,y+ysign*5,MUTED,.22)
        p.end()
        if index%2==0:sheets.showPage()
    cards.save();sheets.save()
    with fitz.open(ROOT/'VahakIN_A6_Tabletop_Cards.pdf') as d, zipfile.ZipFile(ROOT/'VahakIN_Tabletop_Card_Images.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for i,page in enumerate(d,1):
            pix=page.get_pixmap(dpi=300,alpha=False)
            archive.writestr(f'VahakIN_Field_Note_{i:02d}.png',pix.tobytes('png'))
    with fitz.open(ROOT/'VahakIN_A5_Duplex_Handout.pdf') as d:
        images=[p.get_pixmap(dpi=115,alpha=False).pil_image() for p in d]
        preview=Image.new('RGB',(images[0].width*2+28,images[0].height+20),'#DDE5E0')
        for i,im in enumerate(images):preview.paste(im,(10+i*(im.width+8),10))
        preview.save(ROOT/'VahakIN_Handout_Preview.png')
    print('Created duplex handout, A6 cards, A4 trim sheets, PNGs and preview.')

if __name__=='__main__':make()
