## About

This is a simple evaluation of different mesh formats used in neuroimaging. Feel free to suggest changes to optimize performance. JavaScript demonstrates a lot of speed variability. To mitigate this, each format is converted 10 times, with the time for the first run omitted.

A few notes on the formats:
 1. [GIfTI](https://www.nitrc.org/projects/gifti/) uses `GZipBase64Binary` with the optimal `RowMajorOrder`.
 2. [mz3](https://github.com/neurolabusc/surf-ice/tree/master/mz3) tested as both GZip compressed and raw formats.
 3. [OBJ](https://brainder.org/tag/wavefront-obj/) is an ASCII format, so a choice must be made regarding file size and precision.
 4. [STL](http://paulbourke.net/dataformats/stl/) format does not re-use vertices. The resulting mesh will appear faceted and use more GPU resources unless one applies a computationally expensive operation to weld vertices.

![formats](formats.png)

## Compiling

This is a simple node.js function that you can replicate on your own computer:

```
$ npm install gifti-reader-js
$ git clone https://github.com/neurolabusc/MeshFormatsJS.git
$ cd MeshFormatsJS
$ node ./meshtest.js

gifti.gii	Size	4384750	Time	683
gz.mz3	Size	3259141	Time	424
raw.mz3	Size	5898280	Time	49
obj.obj	Size	13307997	Time	498
stl.stl	Size	16384084	Time	249
```
