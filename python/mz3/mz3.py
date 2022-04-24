#!/usr/bin/python
# -*- coding: utf-8 -*-

"""mz3 module

This module is reformatted from https://github.com/neurolabusc/surf-ice/blob/master/mz3/mz3.py
"""

__all__ = ['load_mz3_mesh']

##====================================================================================
## dependent libraries
##====================================================================================

import struct
import gzip
import numpy as np
import os


##====================================================================================
##
##====================================================================================

def read(fnm, isVerbose):
    invalid_mz3 = (None, None, None, None)
    faces = []
    verts = []
    rbga = []
    scalar = []
    with open(fnm, 'rb') as f:
        MAGIC = np.fromfile(f, '<u2', 1)[0]
        isGz = False
        if MAGIC != 23117:  # incorrect magic: assume gzip
            isGz = True
            fz = bytearray(gzip.open(fnm, 'r').read())
            MAGIC = np.frombuffer(fz, '<u2', 1, 0)[0]
            if MAGIC != 23117:
                print('Not a valid MZ3 file')
                return invalid_mz3
            ATTR = np.frombuffer(fz, '<u2', 1, 2)[0]
            NFACE = np.frombuffer(fz, '<u4', 1, 4)[0]
            NVERT = np.frombuffer(fz, '<u4', 1, 8)[0]
            NSKIP = np.frombuffer(fz, '<u4', 1, 16)[0]
            isFACE = ATTR & 1 != 0
            isVERT = ATTR & 2 != 0
            isRGBA = ATTR & 4 != 0
            isSCALAR = ATTR & 8 != 0

            # quit if file does not make sense

            if ATTR > 15:
                print('Unable to read future version of MZ3 file')
                return invalid_mz3
            if NVERT < 1:
                print('Unable to read MZ3 files without vertices')
                return invalid_mz3
            if (NFACE < 1) & isFACE:
                print('MZ3 files with isFACE must specify NFACE')
                return invalid_mz3
            pos = 16 + NSKIP  # data
            if isFACE:  # each face is 3 UINT32 vertex indices
                faces = np.frombuffer(fz, '<u4', NFACE * 3, pos)
                pos += NFACE * 12
            if isVERT:  # each vertex is 3 FLOAT32 (xyz)
                verts = np.frombuffer(fz, '<f4', NVERT * 3, pos)
                pos += NVERT * 12
            if isRGBA:  # each vertex has UINT32 RGBA value
                rbga = np.frombuffer(fz, '<u4', NVERT, pos)
                pos += NVERT * 4
            if isSCALAR:
                fz.seek(0, os.SEEK_END)
                NSCALAR = np.floor((len(fz) - pos) / (NVERT
                                   * 4)).astype(int)
                verts = np.frombuffer(fz, '<f4', NVERT * NSCALAR, pos)
                pos += NVERT * NSCALAR * 4
        else:

            # read attributes

            ATTR = np.fromfile(f, '<u2', 1)[0]
            NFACE = np.fromfile(f, '<u4', 1)[0]
            NVERT = np.fromfile(f, '<u4', 1)[0]
            NSKIP = np.fromfile(f, '<u4', 1)[0]
            isFACE = ATTR & 1 != 0
            isVERT = ATTR & 2 != 0
            isRGBA = ATTR & 4 != 0
            isSCALAR = ATTR & 8 != 0

            # quit if file does not make sense

            if ATTR > 15:
                print('Unable to read future version of MZ3 file')
                return invalid_mz3
            if NVERT < 1:
                print('Unable to read MZ3 files without vertices')
                return invalid_mz3
            if (NFACE < 1) & isFACE:
                print('MZ3 files with isFACE must specify NFACE')
                return invalid_mz3
            pos = 16 + NSKIP  # data
            if NSKIP > 0:  # skip bytes
                skip = np.fromfile(f, '<u8', NSKIP)
            if isFACE:  # each face is 3 UINT32 vertex indices
                faces = np.fromfile(f, '<u4', NFACE * 3)
                pos += NFACE * 12
            if isVERT:  # each vertex is 3 FLOAT32 (xyz)
                verts = np.fromfile(f, '<f4', NVERT * 3)
                pos += NVERT * 12
            if isRGBA:  # each vertex has UINT32 RGBA value
                rbga = np.fromfile(f, '<u4', NVERT)
                pos += NVERT * 4
            if isSCALAR:
                f.seek(0, os.SEEK_END)
                NSCALAR = np.floor((f.tell() - pos) / (NVERT
                                   * 4)).astype(int)
                verts = np.fromfile(f, '<f4', NVERT * NSCALAR)
                pos += NVERT * NSCALAR * 4

        # Optional verbose reporting
            # report contents

        if isVerbose:
            print('MAGIC %d ATTR %d' % (MAGIC, ATTR))
            print('NFACE %d NVERT %d NSKIP %d' % (NFACE, NVERT, NSKIP))
            print(' isFACE %r isVERT %r' % (isFACE, isVERT))
            print(' isRGBA %r isSCALAR %r' % (isRGBA, isSCALAR))
        if isVerbose & (len(faces) > 0):
            NFACE = len(faces) // 3
            j = 0
            for i in range(NFACE):
                print('%d face %d %d %d' % (i, faces[j], faces[j + 1],
                        faces[j + 2]))
                j = j + 3
        if isVerbose & (len(verts) > 0):
            NVERT = len(verts) // 3
            j = 0
            for i in range(NVERT):
                print('%d vert %g %g %g' % (i, verts[j], verts[j + 1],
                        verts[j + 2]))
                j = j + 3
        if isVerbose & (len(rbga) > 0):
            for i in range(len(rbga)):
                rgba = struct.unpack('4B', struct.pack('I', rbga[i]))
                print('%d rgba %d %d %d %d' % (i, rgba[0], rgba[1],
                        rgba[2], rgba[3]))
        if isVerbose & (len(scalar) > 0):
            for i in range(len(scalar)):
                print('%d scalar %g' % (i, scalar[i]))
        return (faces, verts, rbga, scalar)


def load_mz3_mesh(filepath, isVerbose):
    (faces, verts, rbga, scalar) = read(filepath, isVerbose)
    if verts is None:
        print('Invalid file')
        return
    return (verts, faces)
