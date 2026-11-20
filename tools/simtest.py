import asyncio, sys, json
from playwright.async_api import async_playwright
MODE = sys.argv[1] if len(sys.argv)>1 else 'race'
CIRC = sys.argv[2] if len(sys.argv)>2 else 'parco'
EXTRA = sys.argv[3] if len(sys.argv)>3 else '{}'
SECS = int(sys.argv[4]) if len(sys.argv)>4 else 200
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        cfg = {'mode':MODE,'circuit':CIRC,'laps':3,'voice':False,'quality':'low','opponents':9,'gridPos':5,'assist':{'brake':True,'steer':True,'line':'brake','tc':True,'abs':True,'autoGear':True}}
        cfg.update(json.loads(EXTRA))
        await pg.evaluate("c=>localStorage.setItem('lo_cfg', JSON.stringify(c))", cfg)
        await pg.reload(); await pg.wait_for_timeout(500)
        await pg.click('#start'); await pg.wait_for_timeout(2500)
        res = await pg.evaluate("""(secs)=>{ const L=window.__lo; const g=L.G; const out=[]; let walls=0;
          for(let k=0;k<secs;k++){ L.sim(1, g=>({steer:0, throttle:1, brake:0, boost:false})); const p=g.race.player;
            if(p.events) walls+=0;
            if(k%10==0) out.push([k, Math.round(p.v*3.6), Math.round(p.dist), +(p.d||0).toFixed(1), p.pos, p.lapTimes.map(x=>+x.toFixed(2)).join('/'), +p.tyre.wear.toFixed(2), +(p.battery||0).toFixed(2), p.damage? +p.damage.toFixed(2):0, g.race.phase]);
            if(g.race.phase==='finished') break; }
          const r=g.race; return {out, laps: r.cars.map(c=>[c.code, c.lapTimes.map(x=>+x.toFixed(2)), c.pos, c.stops, c.tyre.c, c.retired?1:0, +c.tyre.wear.toFixed(2)]), rc: r.control.slice(0,15).map(m=>m.text), radio: r.radio.slice(0,10).map(m=>m.text), corners: g.T.corners.length, L: g.T.L, zones: g.T.zones.map(z=>z.map(Math.round))}; }""", SECS)
        for o in res['out']: print(o)
        print('L', res['L'], 'corners', res['corners'], 'zones', res['zones'])
        for l in res['laps']: print(l)
        print('RC:', res['rc']); print('RADIO:', res['radio'])
        await pg.screenshot(path=f'shots/sim_{MODE}_{CIRC}.png')
        print('\n'.join(errs[:20]))
        await b.close()
asyncio.run(main())
