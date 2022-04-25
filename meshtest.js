//1. Install dependencies
// npm install fflate gifti-reader-js atob pako buffer lzma-purejs bjd numjs
//2. Run tests
// node ./meshtest.js

const fs = require('fs')
const gifti = require('gifti-reader-js')
const fflate = require('fflate')
const jd = require('./lib/jdata.js')
const bjd = require('bjd')
global.atob = require("atob");

function readPLY(buffer) {
  //https://en.wikipedia.org/wiki/PLY_(file_format)
  let len = buffer.byteLength;
  var bytes = new Uint8Array(buffer);
  let pos = 0;
  function readStr() {
    while (pos < len && bytes[pos] === 10) pos++; //skip blank lines
    let startPos = pos;
    while (pos < len && bytes[pos] !== 10) pos++;
    pos++; //skip EOLN
    if (pos - startPos < 1) return "";
    return new TextDecoder().decode(buffer.slice(startPos, pos - 1));
  }
  let line = readStr(); //1st line: magic 'ply'
  if (!line.startsWith("ply")) {
    console.log("Not a valid PLY file");
    return;
  }
  line = readStr(); //2nd line: format 'format binary_little_endian 1.0'
  let isAscii = line.includes("ascii");
  function dataTypeBytes(str) {
    if (str === "char" || str === "uchar" || str === "int8" || str === "uint8")
      return 1;
    if (
      str === "short" ||
      str === "ushort" ||
      str === "int16" ||
      str === "uint16"
    )
      return 2;
    if (
      str === "int" ||
      str === "uint" ||
      str === "int32" ||
      str === "uint32" ||
      str === "float" ||
      str === "float32"
    )
      return 4;
    if (str === "double") return 8;
    console.log("Unknown data type: " + str);
  }
  let isLittleEndian = line.includes("binary_little_endian");
  let nvert = 0;
  let vertIsDouble = false;
  let vertStride = 0; //e.g. if each vertex stores xyz as float32 and rgb as uint8, stride is 15
  let indexCountBytes = 0; //if "property list uchar int vertex_index" this is 1 (uchar)
  let indexBytes = 0; //if "property list uchar int vertex_index" this is 4 (int)
  let nface = 0;
  while (pos < len && !line.startsWith("end_header")) {
    line = readStr();
    if (line.startsWith("comment")) continue;
    //line = line.replaceAll('\t', ' '); // ?are tabs valid white space?
    let items = line.split(/\s/);
    if (line.startsWith("element vertex")) {
      nvert = parseInt(items[items.length - 1]);
      //read vertex properties:
      line = readStr();
      items = line.split(/\s/);
      while (line.startsWith("property")) {
        let datatype = items[1];
        if (items[2] === "x" && datatype.startsWith("double"))
          vertIsDouble = true;
        else if (items[2] === "x" && !datatype.startsWith("float"))
          console.log("Error: expect ply xyz to be float or double: " + line);
        vertStride += dataTypeBytes(datatype);
        line = readStr();
        items = line.split(/\s/);
      }
    }
    if (
      items[items.length - 1] === "vertex_indices" ||
      items[items.length - 1] === "vertex_index"
    ) {
      indexCountBytes = dataTypeBytes(items[2]);
      indexBytes = dataTypeBytes(items[3]);
      continue;
    }
    if (line.startsWith("element face"))
      nface = parseInt(items[items.length - 1]);
  } //while reading all lines of header
  if (vertStride < 12 || indexCountBytes < 1 || indexBytes < 1 || nface < 1)
    console.log("Malformed ply format");
  if (isAscii) {
    let positions = new Float32Array(nvert * 3);
    let v = 0;
    for (var i = 0; i < nvert; i++) {
      line = readStr();
      let items = line.split(/\s/);
      positions[v] = parseFloat(items[0]);
      positions[v + 1] = parseFloat(items[1]);
      positions[v + 2] = parseFloat(items[2]);
      v += 3;
    }
    let indices = new Int32Array(nface * 3);
    let f = 0;
    let isTriangular = true;
    for (var i = 0; i < nface; i++) {
      line = readStr();
      let items = line.split(/\s/);
      if (parseInt(items[0]) > 3) isTriangular = false;
      indices[f] = parseInt(items[1]);
      indices[f + 1] = parseInt(items[2]);
      indices[f + 2] = parseInt(items[3]);
      f += 3;
    }
    if (!isTriangular)
      console.log("Only able to read PLY meshes limited to triangles.");
    return {
      positions,
      indices,
    };
  }
  var reader = new DataView(buffer);
  var positions = [];
  if (vertStride === 12 && isLittleEndian) {
    //optimization: vertices only store xyz position as float
    positions = new Float32Array(buffer, pos, nvert * 3);
    pos += nvert * vertStride;
  } else {
    positions = new Float32Array(nvert * 3);
    let v = 0;
    for (var i = 0; i < nvert; i++) {
      if (vertIsDouble) {
        positions[v] = reader.getFloat64(pos, isLittleEndian);
        positions[v + 1] = reader.getFloat64(pos + 8, isLittleEndian);
        positions[v + 2] = reader.getFloat64(pos + 16, isLittleEndian);
      } else {
        positions[v] = reader.getFloat32(pos, isLittleEndian);
        positions[v + 1] = reader.getFloat32(pos + 4, isLittleEndian);
        positions[v + 2] = reader.getFloat32(pos + 8, isLittleEndian);
      }
      v += 3;
      pos += vertStride;
    }
  }
  var indices = new Int32Array(nface * 3); //assume triangular mesh: pre-allocation optimization
  let isTriangular = true;
  let j = 0;
  if (indexCountBytes === 1 && indexBytes === 4) {
    for (var i = 0; i < nface; i++) {
      let nIdx = reader.getUint8(pos);
      pos += indexCountBytes;
      if (nIdx !== 3) isTriangular = false;
      indices[j] = reader.getUint32(pos, isLittleEndian);
      pos += 4;
      indices[j + 1] = reader.getUint32(pos, isLittleEndian);
      pos += 4;
      indices[j + 2] = reader.getUint32(pos, isLittleEndian);
      pos += 4;
      j += 3;
    }
  } else {
    //not 1:4 index data
    for (var i = 0; i < nface; i++) {
      let nIdx = 0;
      if (indexCountBytes === 1) nIdx = reader.getUint8(pos);
      else if (indexCountBytes === 2)
        nIdx = reader.getUint16(pos, isLittleEndian);
      else if (indexCountBytes === 4)
        nIdx = reader.getUint32(pos, isLittleEndian);
      pos += indexCountBytes;
      if (nIdx !== 3) isTriangular = false;
      for (var k = 0; k < 3; k++) {
        if (indexBytes === 1) indices[j] = reader.getUint8(pos, isLittleEndian);
        else if (indexBytes === 2)
          indices[j] = reader.getUint16(pos, isLittleEndian);
        else if (indexBytes === 4)
          indices[j] = reader.getUint32(pos, isLittleEndian);
        j++;
        pos += indexBytes;
      }
    } //for each face
  } //if not 1:4 datatype
  if (!isTriangular)
    console.log("Only able to read PLY meshes limited to triangles.");
  return {
    positions,
    indices,
  };
}; // readPLY()

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
    var raw;
    raw = fflate.decompressSync(new Uint8Array(buffer));
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
  const fnms = ["obj.obj", "gz.gii",  "raw.gii", "ply.ply", "gz.mz3", "raw.mz3",  "stl.stl", "zlib.jmsh", "zlib.bmsh", "raw.min.json", "raw.bmsh", "lzma.bmsh"];
  //const fnms = ["gz.gii", "gz.mz3", "raw.mz3", "obj.obj", "stl.stl"];
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
      if (ext.toUpperCase() === "PLY") {
        var data = fs.readFileSync(fnm).buffer;
        let obj = readPLY(data);
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
        var jmsh = new jd(JSON.parse(fs.readFileSync(fnm).toString().replace(/\n/g,'')), {usenumjs:false, zlib:'fflate'});
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
          jmsh=new jd(jmsh[0], {usenumjs:false, zlib:'fflate'}).decode();
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