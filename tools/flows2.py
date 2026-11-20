import asyncio, json, sys
from playwright.async_api import async_playwright
DRV = "g=>({steer:0, throttle: g.race.phase==='racing'?1:0, brake:0, boost:false})"
BASE={'voice':False,'quality':'low','difficulty':'rookie','pitGame':False,'assist':{'brake':True,'steer':True,'line':'brake','tc':True,'abs':True,'autoGear':True}}
async def page(b, cfg):
    pg = await b.new_page(viewport={'width':1280,'height':720})
    errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
    c=dict(BASE); c.update(cfg)
    await pg.evaluate("c=>{localStorage.clear(); localStorage.setItem('lo_cfg', JSON.stringify(c))}", c)
    await pg.reload(); await pg.wait_for_timeout(400)
    return pg, errs
async def main():
    which = sys.argv[1]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        if which=='quali':
            pg, errs = await page(b, {'mode':'race','circuit':'riviera','laps':3,'quali':True,'opponents':9})
            await pg.click('#start'); await pg.wait_for_timeout(2500)
            r = await pg.evaluate("d=>{const L=window.__lo,g=L.G; L.sim(80, eval(d)); return {mode:L.cfg.mode, laps:g.race.player.lapTimes, fin:g.race.player.finished}}", DRV)
            print('quali', r)
            await pg.wait_for_timeout(3500); await pg.screenshot(path='shots/f_quali.png')
            await pg.click('#qRace'); await pg.wait_for_timeout(3000)
            r = await pg.evaluate("()=>{const g=window.__lo.G; return {mode:window.__lo.cfg.mode, grid:g.race.standings.map(c=>c.code+':'+c.grid), n:g.race.cars.length}}")
            print('race', r)
            await pg.evaluate("d=>{const L=window.__lo,g=L.G; for(let i=0;i<400;i++){L.sim(1, eval(d)); if(g.race.player.finished) break;}}", DRV)
            await pg.wait_for_timeout(7000); await pg.screenshot(path='shots/f_quick_results.png')
        if which=='champ':
            pg, errs = await page(b, {'mode':'race','laps':3,'opponents':9,'seasonLaps':3,'seasonQuali':False})
            await pg.click('[data-tab=career]'); await pg.click('#newSeason'); await pg.wait_for_timeout(300)
            await pg.screenshot(path='shots/f_champ_menu.png')
            await pg.click('#goRound'); await pg.wait_for_timeout(3000)
            r = await pg.evaluate("()=>({mode:window.__lo.cfg.mode, circ:window.__lo.cfg.circuit, n:window.__lo.G.race.cars.length})"); print(r)
            await pg.evaluate("d=>{const L=window.__lo,g=L.G; for(let i=0;i<400;i++){L.sim(1, eval(d)); if(g.race.player.finished) break;}}", DRV)
            await pg.wait_for_timeout(21000); await pg.screenshot(path='shots/f_champ_results.png')
            r = await pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('lo_profile')).champ; return {round:c.round, pts:c.points}}"); print(r)
            cfg = await pg.evaluate("()=>JSON.parse(localStorage.getItem('lo_cfg'))"); print('saved cfg', cfg.get('circuit'), cfg.get('mode'), cfg.get('laps'), cfg.get('fieldCodes'))
        if which=='grand':
            pg, errs = await page(b, {'mode':'grandstand','circuit':'parco','laps':3,'opponents':11,'quality':'medium'})
            await pg.click('#start'); await pg.wait_for_timeout(3000)
            await pg.screenshot(path='shots/f_gs_pred.png')
            await pg.click('.pchip[data-k=winner]'); await pg.click('.pchip[data-k=sc][data-c=no]'); await pg.click('#pLock')
            await pg.evaluate("()=>window.__lo.sim(9)")
            await pg.wait_for_timeout(2500); await pg.screenshot(path='shots/f_gs_seat.png')
            await pg.click('#gsSeat'); await pg.evaluate("()=>window.__lo.sim(30)"); await pg.wait_for_timeout(2500); await pg.screenshot(path='shots/f_gs_seat2.png')
            await pg.evaluate("()=>{const L=window.__lo,g=L.G; for(let i=0;i<400;i++){L.sim(1); if(g.race.finishedOrder.length>=g.race.cars.filter(c=>!c.retired).length) break;}}")
            await pg.wait_for_timeout(11500); await pg.screenshot(path='shots/f_gs_results.png')
        print('\n'.join(errs[:10]))
        await b.close()
asyncio.run(main())
