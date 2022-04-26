function res=meshtest(doplot)
% 
% meshtest
%  or
% result=meshtest
% result=meshtest(doplot)  % plot the results
%
% Function to benchmark mesh file loading speed in MATLAB
%
% Dependencies: (all dependencies are included)
%    - gii: @gifti/, gifti toolbox by Guillaume Flandin, https://github.com/gllmflndn/gifti
%    - mz3: private/readMz3.m, by Chris Rorden, https://github.com/bonilhamusclab/MRIcroS/
%    - stl: private/stlread.m by Francis Esmonde-White
%    - obj: loadobjfast() at the end of this script, by Qianqian Fang, simple parsing only
%    - jmsh/bmsh/json: jsonlab/, jsonlab toolbox, by Qianqian Fang
%           decompression is done via zmat toolbox, by Qianqian Fang
%
% author: Qianqian Fang <q.fang>
%
% input:
%     doplot: 0 or if not given, do not plot, 1 plot results
%
% output:
%     result: a table with 3 columns: File, Size(byte) and Runtime(ms)
%
% example:
%     meshtest
%     ans =
%           File          Size(byte)    Runtime(ms)
%     ________________    __________    ___________
% 
%     {'gz.gii'      }    4.3848e+06      495.11
%     {'gz.mz3'      }    3.2591e+06      385.92
%     {'raw.mz3'     }    5.8983e+06      295.86
%     {'obj.obj'     }    1.3308e+07      5944.6
%     {'stl.stl'     }    1.6384e+07      1102.9
%     {'zlib.jmsh'   }    4.4056e+06      678.14
%     {'zlib.bmsh'   }     3.259e+06      318.13
%     {'raw.min.json'}    1.2326e+07      3612.4
%     {'raw.bmsh'    }    5.8989e+06      150.75
%     {'lzma.bmsh'   }    2.2953e+06      1360.5
%

path='../meshes';
files={'obj.obj', 'gz.gii',  'raw.gii', 'ply.ply', 'gz.mz3', 'raw.mz3',  'stl.stl', 'zlib.jmsh', 'zlib.bmsh', 'raw.min.json', 'raw.bmsh', 'lzma.bmsh'};
expectednode=[163842 3];
expectedface=[327680 3];

filesize=cellfun(@(x) dir([path filesep x]).bytes, files);
runtimes=arrayfun(@(x) loadmesh([path filesep files{x}],expectednode,expectedface), 1:length(files));

if(exist('table','file'))
    res=table(files(:),filesize(:),runtimes(:),'VariableNames',{'File','Size(byte)','Runtime(ms)'});
else
    res={files,filesize,runtimes};
end

if(nargin && doplot)
    figure;
    plot(runtimes, filesize, 'ro');
    hold on;
    text(runtimes, filesize, files)
end

% benchmark function to test mesh loading speed
function runtime=loadmesh(loadfile, expectednode, expectedface)
[fpath, fname, fext]=fileparts(loadfile);
loadfun=str2func(['test' lower(regexprep(fext,'^\.',''))]);
[no,fc]=loadfun(loadfile);
runtime=0;
for i=1:9
    tic;
    [no,fc]=loadfun(loadfile);
    runtime=runtime+toc*1000;
end
fprintf(1,'%s\t%f\n',[fname,fext],runtime);

if(isempty(regexp(fext,'stl', 'once')) && any(size(no)~=expectednode))
    warning([fname, fext, ': expected node size is [%d %d], loaded [%d %d]\n'],expectednode(1),expectednode(2), size(no,1), size(no,2));
end
if(any(size(fc)~=expectedface))
    warning([fname, fext, ': expected node size is [%d %d], loaded [%d %d]\n'],expectedface(1),expectedface(2), size(fc,1), size(fc,2));
end

% parsing functions for each mesh format
function [no,fc]=testgii(fname)
data = gifti(fname);
no=data.vertices;
fc=data.faces;

function [no,fc]=testmz3(fname)
[fc,no] = readMz3(fname);

function [no,fc]=testply(fname)
[fc,no] = readPly(fname);

function [no,fc]=teststl(fname)
[no, fc] = stlread(fname);

function [no,fc]=testjmsh(fname)
data = loadjd(fname);
no=data.MeshVertex3;
fc=data.MeshTri3;

function [no,fc]=testbmsh(fname)
data = loadjd(fname);
no=data.MeshVertex3;
fc=data.MeshTri3;

function [no,fc]=testjson(fname)
data = loadjd(fname);
no=data.MeshVertex3;
fc=data.MeshTri3;

function [no,fc]=testobj(fname)
[no, fc] = loadobjfast(fname);

function [no,fc]=loadobjfast(fname)
str = fileread(fname);
nodestr=regexprep(str,'[#f][^\n]+\n','');
no=textscan(nodestr,'v %f %f %f');
facestr=regexprep(regexprep(str,'[#v][^\n]+\n',''),'f\s+(\d+)/\d+\s+(\d+)/\d+\s+(\d+)/\d+', 'f \1 \2 \3');
fc=textscan(facestr,'f %d %d %d');
no=cell2mat(no);
fc=cell2mat(fc);
