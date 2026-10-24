# Descriptive Statistics golden datasets (fixed seeds) — compared with
# Minitab's Graphical Summary / Display Descriptive Statistics.
# Run: python3 tests/golden/descriptive/make_datasets.py
import json, os, numpy as np

def rnd(vals, res):
    return [round(round(v / res) * res, 4) for v in vals]

sets = []
sets.append(dict(id='D01', name='Teaching set 1..10',
  purpose='Quartile method: positions (n+1)/4 vs Excel PERCENTILE.INC give different Q1/Q3 (2.75/8.25 vs 3.25/7.75).',
  data=[float(v) for v in range(1, 11)]))
rng = np.random.default_rng(101)
sets.append(dict(id='D02', name='Normal, n = 30, 3 decimals',
  purpose='Typical measurement study; every statistic and all three confidence intervals.',
  data=rnd(rng.normal(25.0, 0.10, 30), 0.001)))
rng = np.random.default_rng(102)
sets.append(dict(id='D03', name='Odd n = 11',
  purpose='Median is a data point; quartile positions 3 and 9 are whole numbers.',
  data=rnd(rng.normal(12.5, 0.4, 11), 0.01)))
rng = np.random.default_rng(103)
sets.append(dict(id='D04', name='Very small n = 7',
  purpose='Below 8 points: no normality test on the site; wide intervals.',
  data=rnd(rng.normal(3.20, 0.05, 7), 0.001)))
rng = np.random.default_rng(104)
sets.append(dict(id='D05', name='Right-skewed, n = 100',
  purpose='Normality rejected; median CI method (nonlinear interpolation) matters most here.',
  data=rnd(rng.lognormal(1.0, 0.45, 100), 0.01)))
rng = np.random.default_rng(105)
d6 = rnd(rng.normal(50.0, 0.6, 49), 0.1) + [53.8]
sets.append(dict(id='D06', name='Ties (resolution 0.1) + one high outlier, n = 50',
  purpose='Repeated values and an outlier beyond Q3 + 1.5 IQR (box plot whisker).',
  data=d6))
for s in sets:
    s['n'] = len(s['data'])
json.dump(sets, open(os.path.join(os.path.dirname(__file__), 'datasets.json'), 'w'), indent=1)
print([(s['id'], s['n']) for s in sets])
