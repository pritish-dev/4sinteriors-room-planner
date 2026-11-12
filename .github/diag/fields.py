import sys,re,xml.etree.ElementTree as ET
t=ET.parse(sys.argv[1]).getroot()
def c(n):
  x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));return f"{(x1+x2)//2} {(y1+y2)//2}"
nodes=list(t.iter('node'))
if len(sys.argv)>2:
  for n in nodes:
    s=(n.get('text') or '')+' '+(n.get('content-desc') or '')
    if s.strip(): print(s.strip())
  sys.exit()
eds=[n for n in nodes if n.get('class')=='android.widget.EditText']
btn=[n for n in nodes if (n.get('text') or n.get('content-desc') or '').strip()=='Sign in' and n.get('class')=='android.widget.Button']
print(c(eds[0]) if eds else '0 0');print(c(eds[1]) if len(eds)>1 else '0 0');print(c(btn[0]) if btn else '0 0')
