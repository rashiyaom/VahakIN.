import os
os.environ['MPLCONFIGDIR']='/tmp/ig-poster-mpl'
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
import qrcode
ROOT=Path(__file__).parent;A=ROOT/'assets'
font_manager.fontManager.addfont('/System/Library/Fonts/Supplemental/Arial.ttf')
plt.rcParams.update({'font.family':'Arial','font.size':12,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#233743','text.color':'#233743','xtick.color':'#50616A','ytick.color':'#50616A','axes.edgecolor':'#BBC8CE','figure.facecolor':'white','savefig.facecolor':'white'})
teal='#087F83';navy='#163446';amber='#B76A16'
d=np.genfromtxt(A/'imu-software-test.csv',delimiter=',',names=True);t=d['time_s']
fig,ax=plt.subplots(2,1,figsize=(7.15,3.05),sharex=True,gridspec_kw={'height_ratios':[1,1]})
for a in ax:
 a.axvspan(0,5,color='#EFF4F6');a.axvspan(7,7.4,color='#F5E6D0');a.axvspan(12,16,color='#DDF1EE');a.grid(axis='y',alpha=.2)
ax[0].plot(t,d['dynamic_g'],color=teal,lw=1.6,label='Dynamic acceleration')
ax[0].axhline(.12,color=amber,lw=1,ls='--');ax[0].set_ylabel('a dyn (g)');ax[0].set_ylim(0,.5);ax[0].text(25,.14,'0.12 g',ha='right',fontsize=10,color=amber)
ax[0].text(2.5,.42,'Calibration',ha='center',fontsize=10);ax[0].text(8.5,.42,'0.4 s bump',ha='center',fontsize=10);ax[0].text(14,.42,'Sustained motion',ha='center',fontsize=10)
ax[1].plot(t,d['rotation_dps'],color=navy,lw=1.6);ax[1].axhline(12,color=amber,lw=1,ls='--');ax[1].set_ylim(0,24);ax[1].set_ylabel('Rotation (°/s)');ax[1].set_xlabel('Time (s)');ax[1].set_xlim(0,26)
e=t[d['event']==1];
for v in e:
 ax[1].axvline(v,color=teal,ls=':',lw=1.6);ax[1].annotate(f'Event at {v:.2f} s',xy=(v,18),xytext=(17,20),fontsize=11,arrowprops={'arrowstyle':'->','color':teal},color=teal)
fig.subplots_adjust(left=.13,right=.98,bottom=.18,top=.96,hspace=.16)
fig.savefig(A/'imu-plot.png',dpi=300);fig.savefig(A/'imu-plot.pdf');plt.close(fig)
# Explicitly illustrative positions, not logged GNSS measurements.
time=np.arange(0,45,5);distance=np.array([18,35,70,120,158,172,184,201,225]);np.savetxt(A/'location-illustration.csv',np.c_[time,distance],delimiter=',',header='time_s,distance_m',comments='')
fig,ax=plt.subplots(figsize=(7.15,2.65));ax.axhspan(125,175,color='#F5E6D0',label='Boundary uncertainty band');ax.axhline(150,color=amber,ls='--',lw=1);ax.axhline(175,color=amber,ls=':',lw=1.4)
ax.plot(time,distance,'o-',color=teal,lw=2,ms=5);ax.scatter([35],[201],s=100,facecolor=navy,zorder=5)
ax.annotate('Exit confirmed\n2 fixes, 5 s apart',xy=(35,201),xytext=(6,220),fontsize=11,arrowprops={'arrowstyle':'->','color':navy})
ax.text(1,153,'150 m parking radius',fontsize=10,color=amber);ax.text(1,178,'175 m exit threshold',fontsize=10,color=amber)
ax.set(xlim=(0,40),ylim=(0,260),xlabel='Time (s)',ylabel='Distance from centre (m)');ax.grid(axis='y',alpha=.18)
fig.subplots_adjust(left=.13,right=.98,bottom=.23,top=.95);fig.savefig(A/'location-plot.png',dpi=300);fig.savefig(A/'location-plot.pdf');plt.close(fig)
fig,ax=plt.subplots(figsize=(7.15,1.35));y=np.arange(2);values=np.array([878441,870137])/1310720*100
ax.barh(y,values,color=[teal,navy],height=.45);ax.set_yticks(y,['Basic','Plus']);ax.invert_yaxis();ax.set_xlim(0,100);ax.set_xticks([0,25,50,75,100]);ax.set_xlabel('Application partition used (%)',fontsize=11)
for i,v in enumerate(values):ax.text(v+1.5,i,f'{v:.1f}%',va='center',fontsize=12)
ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True);fig.subplots_adjust(left=.13,right=.98,bottom=.38,top=.95);fig.savefig(A/'memory-plot.png',dpi=300);fig.savefig(A/'memory-plot.pdf');plt.close(fig)
for name,url in [('github','https://github.com/rashiyaom/VahakIN.'),('research','https://drive.google.com/drive/folders/1QIngqlW2LFyZHwtl3ehswaF-s6ArddJZ?usp=sharing')]:
 q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,box_size=16,border=4);q.add_data(url);q.make(fit=True);q.make_image(fill_color='#163446',back_color='white').save(A/(name+'-qr.png'))
print('Figures and QR codes generated; IMU events:',e.tolist())
