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
      time=[2143, 545, 28, 5236, 1053, 625, 1239],
      bytes=[4384750, 3259141, 5898280, 13307997, 16384084,4405604,12325881],
      points=['GIfTIgz', 'MZ3gz', 'MZ3raw', 'OBJ', 'STL', 'JMSHz','JSONraw']
   )
)

# Scatter plot
ax = df.plot.scatter(title='Ryzen4800H', x='time', y='bytes', alpha=0.5)

# Annotate each data point
for i, txt in enumerate(df.points):
   ax.annotate(txt, (df.time.iat[i], df.bytes.iat[i]))

#plt.show()
plt.savefig('Ryzen.png', dpi=300)