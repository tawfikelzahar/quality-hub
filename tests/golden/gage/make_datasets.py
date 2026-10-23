import json, numpy as np
SAMPLE=[[[70.8,70.9,70.8],[71.4,71.5,71.5],[71.3,71.2,71.3],[70.8,70.7,70.8],[71.1,71.2,71.3],[71.2,71.2,71.3],[71.3,71.2,71.3],[71.2,71.2,71.1],[70.8,70.7,70.7],[71.4,71.4,71.3]],
[[70.8,70.9,70.9],[71.4,71.4,71.5],[71.3,71.3,71.2],[70.7,70.7,70.7],[71.3,71.2,71.2],[71.3,71.3,71.2],[71.3,71.3,71.2],[71.1,71.2,71.1],[70.7,70.7,70.7],[71.3,71.3,71.4]],
[[70.8,70.8,70.8],[71.4,71.4,71.4],[71.2,71.2,71.3],[70.8,70.7,70.8],[71.2,71.2,71.3],[71.2,71.2,71.3],[71.3,71.3,71.3],[71.2,71.2,71.1],[70.7,70.7,70.7],[71.3,71.3,71.4]]]
def gen(seed, nA, nP, nT, parts, bias, inter_sd, noise_sd, res, inter_fixed=None, spikes=()):
    rng=np.random.default_rng(seed)
    inter=rng.normal(0,inter_sd,(nA,nP)) if inter_sd else np.zeros((nA,nP))
    if inter_fixed:
        for (a,p),v in inter_fixed.items(): inter[a,p]+=v
    out=[]
    for a in range(nA):
        ap=[]
        for p in range(nP):
            vals=[parts[p]+bias[a]+inter[a,p]+rng.normal(0,noise_sd) for _ in range(nT)]
            ap.append(vals)
        out.append(ap)
    for a,p,t,d in spikes: out[a][p][t]+=d
    return [[[round(round(v/res)*res, 4) for v in ap] for ap in a] for a in out]
sets=[]
sets.append(dict(id='GR01',name='Site sample (3 appraisers × 10 parts × 3 trials)',purpose='The example in the tool. AV comes out 0 (appraiser differences smaller than repeatability).',appraisers=['A','B','C'],lsl=70.0,usl=72.0,data=SAMPLE))
p10=[10.00,10.35,9.80,10.20,9.65,10.45,9.90,10.10,9.75,10.30]
sets.append(dict(id='GR02',name='Reproducibility dominant (appraiser C reads high)',purpose='AV clearly larger than EV; Appraiser effect significant in ANOVA.',appraisers=['A','B','C'],lsl=9.0,usl=11.0,
  data=gen(2,3,10,3,p10,[0,0.01,0.09],0,0.012,0.005)))
sets.append(dict(id='GR03',name='Poor repeatability + one range above UCL',purpose='%GRR > 30% of tolerance; one out-of-control range (Appraiser B, Part 6).',appraisers=['A','B','C'],lsl=4.8,usl=5.2,
  data=gen(3,3,10,3,[5.00,5.08,4.95,5.03,4.97,5.06,4.92,5.01,5.10,4.98],[0,0.005,-0.005],0,0.03,0.005,spikes=[(1,5,2,0.16)])))
sets.append(dict(id='GR04',name='Part × Appraiser interaction',purpose='Appraiser B reads parts 3 and 8 differently: interaction significant (ANOVA, not pooled).',appraisers=['A','B','C'],lsl=24.0,usl=26.0,
  data=gen(4,3,10,3,[25.00,25.30,24.75,25.15,24.85,25.40,24.95,25.20,24.70,25.05],[0,0,0],0,0.01,0.005,inter_fixed={(1,2):0.06,(1,7):-0.06,(0,4):0.02})))
sets.append(dict(id='GR05',name='Low discrimination (ndc < 5)',purpose='Parts barely differ: acceptable vs a wide tolerance but ndc below 5.',appraisers=['A','B','C'],lsl=48.0,usl=52.0,
  data=gen(5,3,10,3,[50.00,50.02,49.99,50.01,49.98,50.03,50.00,49.97,50.02,50.01],[0,0.003,-0.002],0,0.008,0.001)))
sets.append(dict(id='GR06',name='2 appraisers × 10 parts × 2 trials, no tolerance',purpose='Other K1/K2 constants; verdict on %Study Variation (no specs). ANOVA keeps the interaction (p < 0.25).',appraisers=['A','B'],lsl=None,usl=None,
  data=gen(6,2,10,2,[2.10,2.25,2.05,2.30,2.15,2.40,2.00,2.20,2.35,2.12],[0,0.012],0,0.01,0.001)))
for s in sets:
    s['appraisers_n']=len(s['data']); s['parts']=len(s['data'][0]); s['trials']=len(s['data'][0][0])
json.dump(sets, open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'datasets.json'),'w'), indent=1)
print([ (s['id'], s['appraisers_n'], s['parts'], s['trials']) for s in sets])
