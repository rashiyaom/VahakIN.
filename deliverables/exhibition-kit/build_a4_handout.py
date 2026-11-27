"""Single-sided, monochrome A4 exhibition handout."""
from PIL import Image
import fitz
from build_kit import Page, ROOT, ASSETS, ACT, RULES, REPO, RESEARCH, pdf, POINTS, HexColor

BLACK, GREY, RULE, TINT, WHITE = '#000000', '#3D3D3D', '#B8B8B8', '#F1F1F1', '#FFFFFF'
BRIEF = 'https://www.sfic.co.in/problem_statement.php'


def build():
    c = pdf('VahakIN_A4_Exhibition_Handout.pdf', 210, 297)
    p = Page(c, 210, 297)
    p.box(0,0,210,297,WHITE)
    p.line(12,11,198,11,BLACK,1.15)
    p.brand(13,16,BLACK)
    p.text('SFIC 2026  /  FINTECH  /  GUJARAT',104,17,94,9.5,True,BLACK,'right',max_h=6)

    p.text('Declared off-road.\nStill moving?',12,28,136,30,True,BLACK,max_h=27)
    p.text('A GPS system for vehicles declared Non-Use',12,57,140,11.5,True,BLACK,max_h=6)
    # Line art keeps the lead visual legible on a monochrome photocopy.
    p.ring(172,46,21,BLACK,.4,[1.5,1.2]);p.ring(172,46,15,BLACK,.25)
    p.car(164,41,1,BLACK,BLACK)
    p.arrow(180,46,195,35,BLACK,.65);p.dot(195,35,1.8,WHITE,BLACK)

    p.box(12,70,186,30,BLACK,radius=1.4)
    p.text('PS000225   /   THE COLLECTOR OFFICE–RAJKOT BRIEF',16,73,178,10.1,True,WHITE,max_h=6)
    p.text('How can owners and the Regional Transport Office (RTO) detect suspected use of declared Non-Use vehicles? They can be parked across private garages and depots, making it hard to spot unauthorised trips or investigate possible tax misuse.',16,80,178,10.1,color=WHITE,max_h=18)

    p.text('How VahakIN helps the RTO',12,106,186,16,True,BLACK,max_h=8)
    stages=[('01','DECLARE','Owner submits Form NT and vehicle documents. The RTO reviews the application.'),('02','DETECT','The device filters short bumps. Two quality GPS fixes can confirm a parking geofence exit.'),('03','REVIEW','Staff check movement permission and hear the owner’s explanation before a tax decision.')]
    for i,(num,title,detail) in enumerate(stages):
        x=12+i*63
        p.box(x,117,60,23,WHITE,RULE,1.3)
        p.text(f'{num}   {title}',x+3,119,54,9.4,True,BLACK,max_h=5)
        p.text(detail,x+3,125.5,54,8,color=GREY,max_h=14)

    p.text('Gujarat’s Non-Use and tax rules',12,146,186,16,True,BLACK,max_h=8)
    rules=[
        ('RULE 5  /  FORM NT','Declare the Non-Use period, reason and garage address. Form NT calls for prior permission before removing the vehicle.',RULES),
        ('ACT  /  §3(2)','The Taxation Authority certifies qualifying Non-Use periods. VahakIN records review evidence and certification status.',ACT),
        ('ACT  /  §§18(1A), 18(1B)','For qualifying use during declared Non-Use, the authority may levy a penalty of twice the applicable tax. The two §18 penalties do not stack.',ACT),
    ]
    for i,(label,detail,url) in enumerate(rules):
        y=157+i*12.2
        p.box(12,y,186,12.2,TINT if i%2==0 else WHITE)
        p.text(label,15,y+2.4,53,8.8,True,BLACK,max_h=7,link=url)
        p.text(detail,69,y+1.6,126,8.9,color=BLACK,max_h=10.4)
    p.text('Tax demo   ₹6,000 assumed base + ₹12,000 potential penalty = ₹18,000',12,197,186,10.25,True,BLACK,max_h=6)
    p.text('Illustrative estimate. Staff must verify the vehicle category, assessable period and notified rates for an official decision.',12,203,186,8.1,color=GREY,max_h=8)

    p.text('Two devices for autonomous monitoring',12,215,126,13.1,True,BLACK,max_h=7)
    for x, label, price, hardware in [
        (12,'BASIC TRACKER','₹1,800','MPU-6050 · NEO-6M GNSS'),
        (74,'PREMIUM PLUS','₹3,400','QMI8658 · watch GNSS*'),
    ]:
        p.box(x,224,59,20,WHITE,RULE,1.3)
        p.text(label,x+3,226,53,8.3,True,BLACK,max_h=5)
        p.text(price,x+3,230.4,53,13.4,True,BLACK,max_h=6)
        p.text(hardware,x+3,237,53,7.8,color=GREY,max_h=5)
    p.text('The devices are designed to capture and upload data independently of a phone. *Plus GNSS and standalone modems are planned.',12,247,122,8.1,color=GREY,max_h=10)

    p.box(139,215,59,43,TINT,BLACK,1.5)
    p.text('QUICK PUZZLE',142,218,53,9.0,True,BLACK,max_h=6)
    p.text('The exit line is 175 m. Two valid fixes arrive 5 s apart at 181 m and 189 m. Which confirms the exit?',142,224,53,8.7,color=BLACK,max_h=21)
    p.text('Circle   FIRST   /   SECOND',142,244,53,8.2,True,BLACK,max_h=5)
    p.c.saveState();p.c.translate(195,297-252);p.c.rotate(180)
    p.c.setFont('Bold',7.3/POINTS);p.c.setFillColor(HexColor(BLACK));p.c.drawString(0,0,'SECOND: both fixes qualify.');p.c.restoreState()

    p.line(12,263,198,263,BLACK,.6)
    p.text('TEAM VAHIKIN.  /  TM002281',12,267,131,9.3,True,BLACK,max_h=5)
    p.text('Om Rashiya · Devanshi Patel · Aadya Raval · Lakshit Hirpara · Vaidehi Patel',12,273,130,8.25,color=BLACK,max_h=8)
    p.text('Mentor  Prof. Abhishek Patel  /  CSPIT, CHARUSAT',12,281.5,130,8.1,color=GREY,max_h=5)
    p.text('Official challenge listing · PS000225',12,287,130,7.7,color=BLACK,link=BRIEF,max_h=5)
    for x,asset,dest,label in [(149,'github',REPO,'GitHub'),(176,'research',RESEARCH,'Research')]:
        qr=ROOT/f'.{asset}-mono.png'
        with Image.open(ASSETS/f'{asset}-qr.png') as im:
            im.convert('L').point(lambda v:255 if v>128 else 0,'1').save(qr)
        p.img(qr,x,266,21,21,dest);qr.unlink()
        p.text(label,x,287.5,21,7.8,True,BLACK,'center',max_h=5)
    p.end();c.showPage();c.save()
    with fitz.open(ROOT/'VahakIN_A4_Exhibition_Handout.pdf') as doc:
        doc[0].get_pixmap(dpi=130,alpha=False).save(ROOT/'VahakIN_A4_Exhibition_Handout_Preview.png')


if __name__=='__main__':
    build()
