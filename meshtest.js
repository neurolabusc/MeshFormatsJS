//1. Install dependencies
// ; install nifti-reader-js
//2. Run tests
// node ./meshtest.js

const fs = require('fs')
const gifti = require('gifti-reader-js')
const pako = require('pako')
const jd = require('./lib/jdata.js')
const bjd = require('./lib/bjdata.js')
global.atob = require("atob");


function readMZ3(buffer) {
  if (buffer.byteLength < 20)
    //76 for raw, not sure of gzip
    throw new Error("File too small to be mz3: bytes = " + buffer.byteLength);
  var reader = new DataView(buffer);
  //get number of vertices and faces
  var magic = reader.getUint16(0, true);
  var _buffer = buffer;
  if (magic === 35615 || magic === 8075) {
    //gzip signature 0x1F8B in little and big endian
    //console.log("detected gzipped mz3");
    //HTML should source an inflate script:
    // <script src="https://cdn.jsdelivr.net/pako/1.0.3/pako.min.js"></script>
    // <script src="js/libs/gunzip.min.js"></script>
    //for decompression there seems to be little real world difference
    var raw;
    if (typeof pako === "object" && typeof pako.deflate === "function") {
      raw = pako.inflate(new Uint8Array(buffer));
    } else if (typeof Zlib === "object" && typeof Zlib.Gunzip === "function") {
      var inflate = new Zlib.Gunzip(new Uint8Array(buffer)); // eslint-disable-line no-undef
      raw = inflate.decompress();
    } else
      alert(
        "Required script missing: include either pako.min.js or gunzip.min.js"
      );
    //console.log("gz->raw %d->%d", buffer.byteLength, raw.length);
    var reader = new DataView(raw.buffer);
    var magic = reader.getUint16(0, true);
    _buffer = raw.buffer;
    //throw new Error( 'Gzip MZ3 file' );
  }
  var attr = reader.getUint16(2, true);
  var nface = reader.getUint32(4, true);
  var nvert = reader.getUint32(8, true);
  var nskip = reader.getUint32(12, true);
  if (magic != 23117) throw new Error("Invalid MZ3 file");
  var isFace = attr & 1;
  var isVert = attr & 2;
  var isRGBA = attr & 4;
  var isSCALAR = attr & 8;
  var isDOUBLE = attr & 16;
  var isAOMap = attr & 32;
  if (attr > 63) throw new Error("Unsupported future version of MZ3 file");
  if (!isFace || !isVert || nface < 1 || nvert < 3)
    throw new Error("Not a mesh MZ3 file (maybe scalar)");
  var filepos = 16 + nskip;
  var indices = null;
  if (isFace) {
    indices = new Int32Array(_buffer, filepos, nface * 3, true);
    filepos += nface * 3 * 4;
  }
  var positions = null;
  if (isVert) {
    positions = new Float32Array(_buffer, filepos, nvert * 3, true);
    filepos += nvert * 3 * 4;
  }
  var colors = null;
  if (isRGBA) {
    colors = new Float32Array(nvert * 3);
    var rgba8 = new Uint8Array(_buffer, filepos, nvert * 4, true);
    filepos += nvert * 4;
    var k3 = 0;
    var k4 = 0;
    for (var i = 0; i < nvert; i++) {
      for (var j = 0; j < 3; j++) {
        //for RGBA
        colors[k3] = rgba8[k4] / 255;
        k3++;
        k4++;
      }
      k4++; //skip Alpha
    } //for i
  } //if isRGBA
  //
  var uv2 = null;
  if (!isRGBA && isSCALAR && isAOMap) {
    var scalars = new Float32Array(_buffer, filepos, nvert, true);
    filepos += nvert * 4;
    /*var mn = scalars[0];
    var mx = scalars[0];
    for ( var i = 0; i < nvert; i ++ ) {
      if (scalars[i] < mn) mn = scalars[i];
      if (scalars[i] > mx) mx = scalars[i];
    }
    console.log("scalar range %g...%g", mn, mx);*/
    uv2 = new Float32Array(nvert * 2);
    for (var i = 0; i < nvert; i++) {
      uv2[i * 2] = uv2[i * 2 + 1] = scalars[i];
    }
  }
  return {
    positions,
    indices,
    uv2,
    colors,
  };
}; // readMZ3()

readSTL = function (buffer) {
  if (buffer.byteLength < 80 + 4 + 50)
    throw new Error("File too small to be STL: bytes = " + buffer.byteLength);
  var reader = new DataView(buffer);
  let sig = reader.getUint32(80, true);
  if (sig === 1768714099)
    throw new Error("Only able to read binary (not ASCII) STL files.");
  var ntri = reader.getUint32(80, true);
  let ntri3 = 3 * ntri;
  if (buffer.byteLength < 80 + 4 + ntri * 50)
    throw new Error("STL file too small to store triangles = ", ntri);
  var indices = new Int32Array(ntri3);
  var positions = new Float32Array(ntri3 * 3);
  let pos = 80 + 4 + 12;
  let v = 0; //vertex
  for (var i = 0; i < ntri; i++) {
    for (var j = 0; j < 9; j++) {
      positions[v] = reader.getFloat32(pos, true);
      v += 1;
      pos += 4;
    }
    pos += 14; //50 bytes for triangle, only 36 used for position
  }
  for (var i = 0; i < ntri3; i++) indices[i] = i;
  return {
    positions,
    indices,
  };
}; // readSTL()

async function main() {
  const fnms = ["gz.gii", "gz.mz3", "raw.mz3", "obj.obj", "stl.stl", "zlib.jmsh", "zlib.bmsh", "raw.min.json", "raw.bmsh", "lzma.bmsh"];
  //const fnms = ["gifti.gii", "gz.mz3", "raw.mz3", "obj.obj", "stl.stl"];
  let npt = 491526; //number of points, each vertex has 3 (XYZ)
  let nidx = 983040; //number of indices: each triangle has 3
  let nrepeats = 10;
  for (let i = 0; i < fnms.length; i++) {
    fnm = './meshes/'+fnms[i];
    if (!fs.existsSync(fnm)) {
      console.error("Unable to find mesh: "+fnm);
      continue;
    }
    //find file size:
    var dat = fs.readFileSync(fnm);

    //determine format based on extension
    var re = /(?:\.([^.]+))?$/;
    let ext = re.exec(fnm)[1];
    let d = Date.now()
    let points = [];
    let indices = [];
    for (let i = 0; i < nrepeats; i++) {
      if (i == 1) d = Date.now(); //ignore first run for interpretting/disk
      if (ext.toUpperCase() === "OBJ") {
        let txt = fs.readFileSync(fnm, {encoding:'utf8', flag:'r'});
        var lines = txt.split("\n");
        var n = lines.length;
        let pts = [];
        let ts = [];
        for (let i = 0; i < n; i++) {
          let str = lines[i];
          if (str[0] === "v" && str[1] === " ") {
            //'v ' but not 'vt' or 'vn'
            let items = str.split(" ");
            pts.push(parseFloat(items[1]));
            pts.push(parseFloat(items[2]));
            pts.push(parseFloat(items[3]));
          }
          if (str[0] === "f") {
            let items = str.split(" ");
            let tn = items[1].split("/");
            ts.push(parseInt(tn - 1));
            tn = items[2].split("/");
            ts.push(parseInt(tn - 1));
            tn = items[3].split("/");
            ts.push(parseInt(tn - 1));
          }
        } //for all lines
        indices = new Int32Array(ts);
        points = new Float32Array(pts);
      } //OBJ
      if (ext.toUpperCase() === "STL") {
        var data = fs.readFileSync(fnm).buffer;
        let obj = readSTL(data);
        points = obj.positions.slice();
        indices = obj.indices.slice();
      }
      if (ext.toUpperCase() === "MZ3") {
        var data = fs.readFileSync(fnm).buffer;
        let obj = readMZ3(data);
        points = obj.positions.slice();
        indices = obj.indices.slice();
      }
      if (ext.toUpperCase() === "GII") {
        var data = fs.readFileSync(fnm);
        var gii = gifti.parse(data);
        points = gii.getPointsDataArray().getData();
        indices = gii.getTrianglesDataArray().getData();
      }
      if (ext.toUpperCase() === "JMSH") {
        var jmsh = new jd(JSON.parse(fs.readFileSync(fnm).toString().replace(/\n/g,'')), {usenumjs:false});
        jmsh=jmsh.decode();
        points = jmsh.data.MeshVertex3;
        indices = jmsh.data.MeshTri3;
      }
      if (ext.toUpperCase() === "BMSH") {
        var jmsh = bjd.decode(fs.readFileSync(fnm));
        if(fnm.match(/raw/)){
          points = jmsh[0].MeshVertex3;
          indices = jmsh[0].MeshTri3;
        }else if(fnm.match(/lzma/)){
          jmsh=new jd(jmsh[0], {usenumjs:false, zlib:'lzma-purejs'}).decode();
          points = jmsh.data.MeshVertex3;
          indices = jmsh.data.MeshTri3;
        }else{
          jmsh=new jd(jmsh[0], {usenumjs:false}).decode();
          points = jmsh.data.MeshVertex3;
          indices = jmsh.data.MeshTri3;
        }
      }
      if (ext.toUpperCase() === "JSON") {
        var jmsh = JSON.parse(fs.readFileSync(fnm).toString().replace(/\n/g,''));
        points = jmsh.MeshVertex3;
        indices = jmsh.MeshTri3;
      }
    } //for j : repeats
    let ms = Date.now() - d;
    console.log(`${fnms[i]}\tSize\t${dat.length}\tTime\t${ms}`);
    if (ext.toUpperCase() === "JSON") { //STL does not reuse vertices
      console.assert(points.length === npt/3, "wrong number of points");
      console.assert(indices.length === nidx/3, "wrong number of indices");
    }else if (ext.toUpperCase() !== "STL") { //STL does not reuse vertices
      console.assert(points.length === npt, "wrong number of points");
      console.assert(indices.length === nidx, "wrong number of indices");
    }
  }
}
main().then(() => console.log('Done'))
