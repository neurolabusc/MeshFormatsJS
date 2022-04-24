"""meshtest.py - loading speed benchmark for various triangular-mesh file formats

This module test the parsing speed for various commonly used and emerging surface
mesh file formats. Along with the benchmarks for JavaScript and MATLAB, this script
provides a meaningful comparison on the trade-offs between file sizes and parsing speed
offered by using different mesh formats. Additionally, similar to the sample scripts
for JavaScript and MATLAB, this script provides a simple list of file loading/parsing
commands to use these formats in Python.

To run this script, one should install the below dependencies via pip

    python3 -mpip install nibabel jdata bjdata numpy-stl meshio numpy pysimdjson

Then one can simply run

    python3 meshtest.py

inside the current folder.

Author: Qianqian Fang <q.fang at neu.edu>

"""

import nibabel as nib           # read .gii
import jdata as jd              # read .jmsh, .bmsh
#import json                     # read .json
import simdjson                 # read .json
import mz3                      # read .mz3
import stl                      # read .stl
import meshio                   # read .obj

import os
import time

files=["gz.gii", "gz.mz3", "raw.mz3", "obj.obj", "stl.stl", "zlib.jmsh", "zlib.bmsh", "raw.min.json", "raw.bmsh"] #"lzma.bmsh"

def loadmeshx10(fname):
    filename=os.getcwd() + '/../meshes/'+fname
    expectednode=163842
    expectedface=327680

    # repeating 10 times, and measure the total run-times for the last 9 iterations
    for x in range(0, 10):
        if(x==1):
            t=time.time()
        points, tris = loadmesh(filename)

    runtime=(time.time()-t)*1000
    print("{}\t{}".format(fname, runtime))

    if(fname.find(".stl")<0 and len(points)!=expectednode and len(points)!=expectednode*3):
        print("node size mismatch: expected {}, got {}".format(expectednode,len(points)))
    if(len(tris)!=expectedface and len(tris)!=expectedface*3):
        print("face size mismatch: expected {}, got {}".format(expectedface,len(tris)))
    return runtime

def loadmesh(filename):
    ext=os.path.splitext(filename)[-1];
    points=[]
    tris=[]
    if(ext=='.gii'):
        obj = nib.load(filename)
        tris, points= obj.agg_data()
    elif(ext == '.mz3'):
        points, tris = mz3.load_mz3_mesh(filename, False)
    elif(ext == '.stl'):
        obj = stl.mesh.Mesh.from_file(filename)
        points = obj.points
        tris = obj.vectors
    elif(ext == '.obj'):  # or .obj, .off, .vtk, .ply, ..., but slow
        obj = meshio.read(filename)
        points = obj.points
        tris = obj.cells[0].data
    elif(ext == '.jmsh' or ext == '.bmsh'):
        obj = jd.load(filename)
        points = obj['MeshVertex3']
        tris = obj['MeshTri3']
    elif(ext == '.json'):
        parser = simdjson.Parser()
        with open(filename, 'r') as fp:
            obj = parser.parse(fp.read())
        points = obj['MeshVertex3']
        tris = obj['MeshTri3']
    else:
        print('skipping file'+fname)
        return points, tris
    return points, tris


# run benchmark
res=map(loadmeshx10, files)
runtimes=list(res)

