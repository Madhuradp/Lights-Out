import asyncio, json
from playwright.async_api import async_playwright
DRV = "g=>({steer:0, throttle: g.race.phase==='racing'?1:0, brake:0, boost:false})"
import sys
IDS=sys.argv[1].split(',')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for sid in IDS:
            pg = await b.new_page(viewport={'width':1280,'height':720})
            errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
            await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
            await pg.evaluate("()=>{localStorage.clear(); localStorage.setItem('lo_cfg', JSON.stringify({voice:false, quality:'low', pitGame:false, assist:{brake:true,steer:true,line:'brake',tc:true,abs:true,autoGear:true}}))}")
            await pg.reload(); await pg.wait_for_timeout(300)
            await pg.click('[data-tab=career]'); await pg.click(f'[data-scen={sid}]'); await pg.wait_for_timeout(2500)
            st = await pg.evaluate("()=>{const g=window.__lo.G; const r=g.race; return {phase:r.phase, laps:r.laps, lap:Math.floor(r.player.dist/g.T.L)+1, order:r.standings.slice(0,6).map(c=>c.code+(c.tyre?':'+c.tyre.c:'')), sc:r.sc, ot:r.otAvailable}}")
            await pg.screenshot(path=f'shots/s_{sid}.png')
            res = await pg.evaluate("d=>{const L=window.__lo,g=L.G; if(L.cfg.mode==='race'&&L.cfg.scenario&&L.cfg.scenario.id==='undercut'){} for(let i=0;i<1000;i++){ if(i===2 && L.cfg.scenario.id==='undercut') g.race.player.pitRequest='H'; if(i===5 && L.cfg.scenario.id==='raingamble') g.race.player.pitRequest='I'; L.sim(1, eval(d)); if(g.race.scenarioResult) break; } const r=g.race; return {res:r.scenarioResult, pos:r.player.pos, t:+r.time.toFixed(0), wet:+r.weather.wet.toFixed(2), stops:r.player.stops, tyre:r.player.tyre.c, lapsDone:r.player.lapTimes.length, fin:r.player.finished, pit:!!r.player.pit}}", DRV)
            print(sid, st, '=>', res, errs[:3])
            await pg.close()
        await b.close()
asyncio.run(main())
