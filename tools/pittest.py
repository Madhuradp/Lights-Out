import asyncio, sys, json
from playwright.async_api import async_playwright
CIRC = sys.argv[1] if len(sys.argv)>1 else 'parco'
MODE = sys.argv[2] if len(sys.argv)>2 else 'race'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        cfg = {'mode':MODE,'circuit':CIRC,'laps':3,'voice':False,'quality':'low','opponents':9,'gridPos':5,'incidents':'normal','weather':'changeable','pitGame':True,'difficulty':'rookie','assist':{'brake':True,'steer':True,'line':'brake','tc':True,'abs':True,'autoGear':True}}
        await pg.evaluate("c=>localStorage.setItem('lo_cfg', JSON.stringify(c))", cfg)
        await pg.reload(); await pg.wait_for_timeout(500)
        await pg.click('#start'); await pg.wait_for_timeout(2500)
        res = await pg.evaluate("""()=>{ const L=window.__lo; const g=L.G; const log=[];
          const drv = g=>({steer:0, throttle: (g.race.phase==='racing'?1:0), brake:0, boost:false});
          L.sim(10, drv);
          const p=g.race.player; p.pitRequest='H';
          let sawPit=false, sawGame=false;
          for(let k=0;k<400;k++){ L.sim(0.5, drv);
             if(p.pit && !sawPit){ sawPit=true; log.push(['pit start', +g.race.time.toFixed(1), Math.round(p.dist)]); }
             if(g.pg && !sawGame){ sawGame=true; log.push(['pitgame', +g.race.time.toFixed(1)]); }
             if(g.pg){ // play the mini game well
                const pg=g.pg; if(pg.phase==='guns'){ pg.m=0.71; L.input.press('action'); } else if(pg.phase==='release'){ if(performance.now()>pg.greenAt) L.input.press('action'); } }
             if(sawPit && !p.pit && !p.auto && log.length<3){ log.push(['pit end', +g.race.time.toFixed(1), p.tyre.c, p.stops, p.lastStop]); }
             if(p.finished && g.race.cars.every(c=>c.finished||c.retired)) break; }
          const res=g.race.results().map(r=>[r.pos,r.code,r.gap,r.stops,r.pen, r.note||'']);
          return {log, res, rc:g.race.control.slice(0,14).map(m=>m.text), radio:g.race.radio.slice(0,8).map(m=>m.from+': '+m.text), wet:g.race.weather.wet, rain: g.race.weather.rain, ph: g.race.phase, pfin: p.finished}; }""")
        print(json.dumps(res, indent=0))
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'shots/pit_{CIRC}.png')
        print('\n'.join(errs[:20]))
        await b.close()
asyncio.run(main())
