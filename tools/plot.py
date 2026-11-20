import json, numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
C=json.load(open('/home/claude/f1proto/tools/circuits.json'))
def cr(P, n=60, alpha=0.5):
    P=np.array(P,float); N=len(P); out=[]
    for i in range(N):
        p0,p1,p2,p3=P[(i-1)%N],P[i],P[(i+1)%N],P[(i+2)%N]
        def tj(ti,pi,pj): return ti+np.linalg.norm(pj-pi)**alpha
        t0=0;t1=tj(t0,p0,p1);t2=tj(t1,p1,p2);t3=tj(t2,p2,p3)
        for t in np.linspace(t1,t2,n,endpoint=False):
            A1=(t1-t)/(t1-t0)*p0+(t-t0)/(t1-t0)*p1
            A2=(t2-t)/(t2-t1)*p1+(t-t1)/(t2-t1)*p2
            A3=(t3-t)/(t3-t2)*p2+(t-t2)/(t3-t2)*p3
            B1=(t2-t)/(t2-t0)*A1+(t-t0)/(t2-t0)*A2
            B2=(t3-t)/(t3-t1)*A2+(t-t1)/(t3-t1)*A3
            out.append((t2-t)/(t2-t1)*B1+(t-t1)/(t2-t1)*B2)
    return np.array(out)
fig,axs=plt.subplots(1,3,figsize=(18,6))
for ax,(k,P) in zip(axs,C.items()):
    Q=cr(P); d=np.diff(np.vstack([Q,Q[:1]]),axis=0); L=np.linalg.norm(d,axis=1).sum()
    # resample
    seg=np.linalg.norm(d,axis=1); cum=np.concatenate([[0],np.cumsum(seg)])
    s=np.arange(0,L,4.0); X=np.interp(s,cum,np.append(Q[:,0],Q[0,0])); Z=np.interp(s,cum,np.append(Q[:,1],Q[0,1]))
    R=np.stack([X,Z],1); t=np.roll(R,-1,0)-np.roll(R,1,0); t/=np.linalg.norm(t,axis=1)[:,None]
    ang=np.unwrap(np.arctan2(t[:,1],t[:,0])); k_=np.gradient(ang)/4.0
    rmin=1/np.max(np.abs(k_))
    ax.plot(X,Z,'-'); ax.plot(X[0],Z[0],'ro'); ax.set_aspect('equal'); ax.invert_yaxis()
    for i,p in enumerate(P): ax.annotate(str(i),p,fontsize=6)
    ax.set_title(f"{k} L={L:.0f}m rmin={rmin:.1f}m")
plt.savefig('/home/claude/f1proto/tools/plot.png',dpi=80)
