"""Realinha as legendas de config.json pela voz real (faster-whisper). Rodar de dentro de producao/<pasta>, depois make_short.py de novo.
Uso quando checar_sync.py der ATENÇÃO: pip install faster-whisper; python3 ../../pipeline/realinhar_legenda.py"""
import subprocess,numpy as np,json,re,difflib,unicodedata,sys
from faster_whisper import WhisperModel
raw=subprocess.run(["ffmpeg","-v","error","-i","voz.mp3","-f","s16le","-ac","1","-ar","16000","-"],capture_output=True).stdout
a=np.frombuffer(raw,np.int16).astype(np.float32)/32768
m=WhisperModel("small",device="cpu",compute_type="int8")
segs,_=m.transcribe(a,language="pt",word_timestamps=True)
W=[(w.start,w.end,w.word.strip()) for s in segs for w in s.words]
EQ={'para':'pra','vi':'6','v':'5','um':'1','dois':'2','tres':'3','90':'noventa','nature':'nate','takes':'take'}
def norm(t):
    t=unicodedata.normalize('NFKD',t.lower()); t=''.join(ch for ch in t if not unicodedata.combining(ch))
    t=re.sub(r'[^\w]','',t); return EQ.get(t,t)
wt=[norm(w[2]) for w in W]
cfg=json.load(open('config.json')); caps=cfg['captions']
EXP={'NATETHEHATE':'nate the hate','18/11':'18 de novembro','90':'noventa','TAKE-TWO':'take two'}
toks=[];owner=[]
for i,c in enumerate(caps):
    for tok in c['text'].split():
        k=re.sub(r'[^\w/\-]','',tok)
        for x in EXP.get(k,tok).split():
            toks.append(norm(x)); owner.append(i)
sm=difflib.SequenceMatcher(None,toks,wt,autojunk=False)
tt=[None]*len(toks)
for blk in sm.get_matching_blocks():
    for j in range(blk.size): tt[blk.a+j]=W[blk.b+j][0]
print('casados',sum(t is not None for t in tt),'de',len(toks))
for i in range(len(caps)):
    idx=[k for k,o in enumerate(owner) if o==i]
    st=next((tt[k] for k in idx if tt[k] is not None),None)
    caps[i]['_s']=st
# fill gaps by interpolation
for i,c in enumerate(caps):
    if c['_s'] is None:
        p=next(caps[j]['_s'] for j in range(i-1,-1,-1) if caps[j]['_s'] is not None)
        q=next((caps[j]['_s'] for j in range(i+1,len(caps)) if caps[j]['_s'] is not None),W[-1][1])
        c['_s']=(p+q)/2; print('interpolado',c['text'])
for i,c in enumerate(caps):
    old=c['start']; c['start']=0.0 if i==0 else round(c['_s'],3)
    c['end']=round(caps[i+1]['_s'],3) if i+1<len(caps) else max(c['end'],round(W[-1][1]+0.2,3))
    del c['_s']
    print(f"{old:6.2f}->{c['start']:6.2f} {c['text']}")
json.dump(cfg,open('config.json','w'),ensure_ascii=False,indent=1)
