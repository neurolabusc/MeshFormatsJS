#!/usr/bin/env python3
# -*- coding: utf-8 -*-

#plot total wall clock time to complete AFNI_data6 https://afni.nimh.nih.gov/pub/dist/doc/htmldoc/background_install/unix_tutorial/misc/install.data.html
# s01.ap.simple  

import pandas as pd
from matplotlib import pyplot as plt

# Set the figure size
plt.rcParams["figure.figsize"] = [7.00, 3.50]
plt.rcParams["figure.autolayout"] = True

# Create a dataframe
df = pd.DataFrame(
   dict(
      time=[4168, 273, 1507, 364, 39, 50, 1742, 1047, 5046, 124],
      mb=[2.3, 3.3, 4.4, 4.4, 5.9, 6.2, 7.9, 12.3, 13.3, 16.4],
      points=['lzma.bmsh', 'zlib.bmsh', 'gz.gii', 'zlib.jmsh', 'raw.bmsh', 'ply.ply', 'raw.gii', 'raw.min.json', 'obj.obj', 'stl.stl']
   )
)

# Scatter plot
ax = df.plot.scatter(title='Ryzen5950X', x='time', y='mb', alpha=0.5)

# Annotate each data point
for i, txt in enumerate(df.points):
   ax.annotate(txt, (df.time.iat[i], df.mb.iat[i]))

#plt.show()
plt.savefig('Ryzen.png', dpi=300)