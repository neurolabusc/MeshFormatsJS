function res=meshtest(doplot)
% 
% meshtest
%  or
% result=meshtest
% result=meshtest(doplot)  % plot the results
%
% Function to benchmark mesh file loading speed in MATLAB and Octave
% tested on MATLAB as old as R2010b and Octave as old as 4.2.2
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

path='../meshes';
files={'obj.obj', 'gz.gii',  'raw.gii', 'ply.ply', 'gz.mz3', 'raw.mz3',  'stl.stl', 'zlib.jmsh', 'zlib.bmsh', 'raw.min.json', 'raw.bmsh', 'lzma.bmsh'};
if(exist('OCTAVE_VERSION','builtin')~=0)
    files={'gz.mz3', 'raw.mz3',  'stl.stl', 'zlib.jmsh', 'zlib.bmsh', 'raw.min.json', 'raw.bmsh', 'lzma.bmsh'};
end
expectednode=[163842 3];
expectedface=[327680 3];

filesize=cellfun(@(x) dir([path filesep x]), files);
filesize=[filesize.bytes]';
runtimes=arrayfun(@(x) loadmesh([path filesep files{x}],expectednode,expectedface), 1:length(files));

if(exist('OCTAVE_VERSION','builtin')~=0)
    res={files(:),filesize(:),runtimes(:)};
elseif(exist('table','file'))
    res=table(files(:),filesize(:),runtimes(:),'VariableNames',{'File','Size_in_byte','Runtime_in_ms'});
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
