## About

This is a simple evaluation of different mesh formats used in neuroimaging. Feel free to suggest changes to optimize performance. JavaScript demonstrates a lot of speed variability. To mitigate this, each format is converted 10 times, with the time for the first run omitted.

A few notes on the formats:
 1. [GIfTI](https://www.nitrc.org/projects/gifti/) uses `GZipBase64Binary` with the optimal `RowMajorOrder`.
 2. [mz3](https://github.com/neurolabusc/surf-ice/tree/master/mz3) tested as both GZip compressed and raw formats.
 3. [OBJ](https://brainder.org/tag/wavefront-obj/) is an ASCII format, so a choice must be made regarding file size and precision.
 4. [STL](http://paulbourke.net/dataformats/stl/) format does not re-use vertices. The resulting mesh will appear faceted and use more GPU resources unless one applies a computationally expensive operation to weld vertices.
 5. [jmsh](https://en.wikipedia.org/wiki/JMesh) is a JSON-based general purpose geometry/mesh-data container based on the [JMesh](https://github.com/NeuroJSON/jmesh/blob/master/JMesh_specification.md) and [JData](https://github.com/NeuroJSON/jdata/blob/master/JData_specification.md) specifications; it is human-readable and widely parsable
 6. [bmsh](https://en.wikipedia.org/wiki/JMesh) is a binary-JSON ([BJData - Draft 2](https://github.com/NeuroJSON/bjdata/blob/Draft_2/Binary_JData_Specification.md)) based mesh-data container based on the JMesh specification; both `.bmsh` and `.jmsh` support data-level compression
 7. [json](http://json.org) is a minimized plain JSON file using [JMesh](https://github.com/NeuroJSON/jmesh/blob/master/JMesh_specification.md) annotations without compression

The plots below show performance on an Apple M1 (15w passively cooled MacBook Air) running macOS and a AMD Ryzen 7 4800H (45w) running Ubuntu 20.04. The trends are extremely similar, with the exception of STL (which was consistently dramatically faster on macOS). To avoid overlapping labels, the plots omit the bmsh format as these formats are very similar to the mz3.
![M1 Performance](M1.png)

![Ryzen Performance](Ryzen.png)

## Compiling

This is a simple node.js function that you can replicate on your own computer:

```
$ npm install gifti-reader-js atob pako buffer lzma-purejs bjd
$ git clone https://github.com/neurolabusc/MeshFormatsJS.git
$ cd MeshFormatsJS
$ node ./meshtest.js

gz.gii	Size	4384750	Time	1905
gz.mz3	Size	3259141	Time	510
raw.mz3	Size	5898280	Time	21
obj.obj	Size	13307997	Time	5491
stl.stl	Size	16384084	Time	163
zlib.jmsh	Size	4405604	Time	593
zlib.bmsh	Size	3259049	Time	464
raw.min.json	Size	12325881	Time	1352
raw.bmsh	Size	5898902	Time	24
lzma.bmsh	Size	2295259	Time	5290

```
