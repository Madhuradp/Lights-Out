import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        await pg.evaluate("c=>localStorage.setItem('lo_cfg', JSON.stringify(c))", {'mode':'pitwall','circuit':'sakura','laps':5,'voice':False,'quality':'low','opponents':11,'gridPos':8,'incidents':'high','weather':'changeable','pitGame':True})
        await pg.reload(); await pg.wait_for_timeout(400); await pg.click('#start'); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""()=>{const L=window.__lo,g=L.G,me=g.race.player; L.sim(40); me.pitRequest='H'; me.push='attack'; let game=0;
          for(let i=0;i<4000;i++){ L.sim(0.1); if(g.pg){ game++; g.pg.car.pit && g.pg.car.pit.timer>2.5 && g.pg.car.releaseFromBox && (g.pg.car.releaseFromBox(), g.pg=null);} if(me.stops>=1 && !me.pit) break; }
          L.sim(30);
          return {stops:me.stops, tyre:me.tyre.c, pos:me.pos, game, lap:me.lapTimes.length, wet:+g.race.weather.wet.toFixed(2), rain:+g.race.weather.rain.toFixed(2), rc:g.race.control.slice(0,10).map(m=>m.text), radio:g.race.radio.slice(0,6).map(m=>m.from+': '+m.text), field:g.race.standings.map(c=>c.code+':'+c.tyre.c+':'+c.stops+(c.retired?'X':''))}}""")
        print(json.dumps(r, indent=0))
        await pg.wait_for_timeout(1500); await pg.screenshot(path='shots/pw_after.png')
        print(errs[:10])
        await b.close()
asyncio.run(main())
