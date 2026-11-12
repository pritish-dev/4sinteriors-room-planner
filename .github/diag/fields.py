import sys,re,xml.etree.ElementTree as ET
t=ET.parse(sys.argv[1]).getroot()
def c(n,dy=0):
  x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));return f"{(x1+x2)//2} {(y1+y2)//2+dy}"
def lab(n): return ((n.get('text') or '')+' '+(n.get('content-desc') or '')+' '+(n.get('hint') or '')).strip()
nodes=list(t.iter('node'))
if len(sys.argv)>2:
  for n in nodes:
    if lab(n) or n.get('class','').endswith('EditText'): print(n.get('class'),'|',lab(n),'|',n.get('bounds'))
  sys.exit()
eds=[n for n in nodes if n.get('class','').endswith('EditText')]
def find(s):
  for n in nodes:
    if lab(n)==s: return n
u=eds[0] if eds else find('Username'); p=eds[1] if len(eds)>1 else find('Password')
b=[n for n in nodes if lab(n)=='Sign in' and n.get('clickable')=='true'] or [find('Sign in')]
print(c(u) if u is not None else '0 0'); print(c(p) if p is not None else '0 0'); print(c(b[-1]) if b[-1] is not None else '0 0')
