import asyncio, json
from playwright.async_api import async_playwright
DRV = "g=>({steer:0, throttle: g.race.phase==='racing'?1:0, brake:0, boost:false})"
async def setup(b, cfg):
    pg = await b.new_page(viewport={'width':1280,'height':720})
    errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
    base={'laps':3,'voice':False,'quality':'low','opponents':9,'gridPos':5,'incidents':'off','weather':'dry','difficulty':'rookie','pitGame':True,'assist':{'brake':True,'steer':True,'line':'brake','tc':True,'abs':True,'autoGear':True}}
    base.update(cfg)
    await pg.evaluate("c=>localStorage.setItem('lo_cfg', JSON.stringify(c))", base)
    await pg.reload(); await pg.wait_for_timeout(400); await pg.click('#start'); await pg.wait_for_timeout(2500)
    return pg, errs
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        # 1) hot lap with ghost at riviera, then tunnel shot
        pg, errs = await setup(b, {'mode':'hotlap','circuit':'riviera','camera':'cockpit'})
        r = await pg.evaluate("d=>{const L=window.__lo,g=L.G; L.sim(200, eval(d)); const p=g.race.player; return {laps:p.lapTimes.map(x=>+x.toFixed(2)), best:p.best, trace:(g.race.bestTrace||[]).length, tl:g.race.control.slice(0,5).map(m=>m.text)}}", DRV)
        print('hotlap', r)
        await pg.evaluate("d=>{const L=window.__lo,g=L.G,T=g.T; for(let i=0;i<4000;i++){ L.sim(0.05, eval(d)); const s=g.race.player.s; if(s>T.tunnel[0]+60 && s<T.tunnel[1]) break; } }", DRV)
        await pg.wait_for_timeout(1200); await pg.screenshot(path='shots/tunnel.png')
        await pg.evaluate("d=>{const L=window.__lo,g=L.G; L.sim(20, eval(d)); g.camMode='chase'}", DRV)
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/hotlap_ghost.png')
        print(errs[:10]); await pg.close()
        # 2) pit game
        pg, errs = await setup(b, {'mode':'race','circuit':'parco'})
        await pg.evaluate("d=>{const L=window.__lo,g=L.G; L.sim(15, eval(d)); g.race.player.pitRequest='H'; for(let i=0;i<3000;i++){ L.sim(0.05, eval(d)); if(g.pg) break; } }", DRV)
        await pg.wait_for_timeout(700); await pg.screenshot(path='shots/pitgame.png')
        # play it for real (time based)
        for i in range(60):
            st = await pg.evaluate("()=>{const g=window.__lo.G; const pg=g.pg; if(!pg) return 'done'; if(pg.phase==='guns' && pg.m>0.66 && pg.m<0.8){ window.__lo.input.press('action'); return 'hit'} if(pg.phase==='release' && performance.now()>pg.greenAt){window.__lo.input.press('action'); return 'go'} return pg.phase }")
            if st=='done': break
            await pg.wait_for_timeout(40)
        await pg.wait_for_timeout(300); await pg.screenshot(path='shots/pitgame_done.png')
        info = await pg.evaluate("()=>{const g=window.__lo.G,p=g.race.player; return {stop:p.lastStop, tyre:p.tyre.c, stops:p.stops, pit:!!p.pit}}")
        print('pit', info)
        # 3) finish & results
        await pg.evaluate("d=>{const L=window.__lo,g=L.G; for(let i=0;i<600;i++){ L.sim(1, eval(d)); if(g.race.player.finished) break; } }", DRV)
        await pg.wait_for_timeout(7000); await pg.screenshot(path='shots/results.png')
        print(errs[:10]); await pg.close()
        await b.close()
asyncio.run(main())
