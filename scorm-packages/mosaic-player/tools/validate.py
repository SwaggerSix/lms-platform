"""Validate activity JSON for the Mosaic player. usage: python3 validate.py file.json [kc_ids.json]"""
import json,sys,re
d=json.load(open(sys.argv[1])); kc=set(json.load(open(sys.argv[2]))) if len(sys.argv)>2 else None
errs=[]
def E(m): errs.append(m)
def html(x,where):
    if not isinstance(x,str) or not x.strip(): E(f"{where}: empty/missing html"); return
    if re.search(r'<script|on\w+=|javascript:',x,re.I): E(f"{where}: unsafe html")
for a in d:
    w=a.get('id','?')
    for k in ('id','title','items'):
        if k not in a: E(f"{w}: missing {k}")
    if 'intro' in a: html(a['intro'],w+'.intro')
    for n,it in enumerate(a.get('items',[])):
        q=f"{w}.items[{n}]"
        if 'ref' in it:
            if kc is not None and it['ref'] not in kc: E(f"{q}: unknown KC ref {it['ref']}")
            continue
        k=it.get('k'); html(it.get('s'),q+'.s')
        if k=='open':
            html(it.get('model'),q+'.model'); continue
        o=it.get('o')
        if not isinstance(o,list) or len(o)<2: E(f"{q}: needs options o"); continue
        for i,x in enumerate(o): html(x,f"{q}.o[{i}]")
        c=it.get('c'); f=it.get('f',{})
        if k=='mcq':
            if not isinstance(c,int) or not 0<=c<len(o): E(f"{q}: mcq c must be option index")
            if not all(str(i) in f for i in range(len(o))) and not it.get('g'): E(f"{q}: mcq needs feedback f for every option or g")
        elif k=='multi':
            if not isinstance(c,list) or not all(isinstance(i,int) and 0<=i<len(o) for i in c): E(f"{q}: multi c list of indexes")
        elif k=='order':
            if not isinstance(c,list) or sorted(c)!=list(range(len(o))): E(f"{q}: order c must be permutation of option indexes")
            if not (it.get('fr') and it.get('fw')): E(f"{q}: order needs fr and fw")
        elif k=='match':
            p=it.get('p')
            if not isinstance(p,list) or not p: E(f"{q}: match needs prompts p"); continue
            for i,x in enumerate(p): html(x,f"{q}.p[{i}]")
            if not isinstance(c,list) or len(c)!=len(p) or not all((isinstance(i,int) and 0<=i<len(o)) or (isinstance(i,list) and i and all(isinstance(x,int) and 0<=x<len(o) for x in i)) for i in c): E(f"{q}: match c = option index per prompt")
            if not (it.get('fr') and it.get('fw')): E(f"{q}: match needs fr and fw")
        else: E(f"{q}: unknown k {k}")
print("OK" if not errs else "\n".join(errs)); sys.exit(1 if errs else 0)
