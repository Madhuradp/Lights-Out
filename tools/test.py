import asyncio, sys, json
from playwright.async_api import async_playwright
MODE = sys.argv[1] if len(sys.argv)>1 else 'race'
CIRC = sys.argv[2] if len(sys.argv)>2 else 'parco'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        await pg.goto('file:///home/claude/f1proto/dist/lights-out.html')
        await pg.wait_for_timeout(800)
        await pg.evaluate(f"localStorage.setItem('lo_cfg', JSON.stringify({{mode:'{MODE}', circuit:'{CIRC}', laps:3, voice:false, quality:'low', opponents:9, gridPos:5}}))")
        await pg.reload(); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'shots/menu.png')
        await pg.click('#start')
        await pg.wait_for_timeout(4000)
        await pg.screenshot(path=f'shots/{MODE}_{CIRC}_grid.png')
        # wait for lights out
        await pg.wait_for_timeout(5000)
        await pg.keyboard.down('ArrowUp')
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path=f'shots/{MODE}_{CIRC}_drive.png')
        info = await pg.evaluate("(()=>{const g=window.__lo.G; const p=g.race.player; return {phase:g.race.phase, v:p.v, dist:p.dist, d:p.d, pos:p.pos, t:g.race.time, fps:0}})()")
        print(json.dumps(info))
        await pg.wait_for_timeout(4000)
        await pg.screenshot(path=f'shots/{MODE}_{CIRC}_drive2.png')
        info = await pg.evaluate("(()=>{const g=window.__lo.G; const p=g.race.player; return {phase:g.race.phase, v:p.v, dist:p.dist, d:p.d, pos:p.pos, t:g.race.time, cars:g.race.cars.map(c=>[c.code, Math.round(c.dist), Math.round(c.v)])}})()")
        print(json.dumps(info))
        print('\n'.join(errs[:30]))
        await b.close()
asyncio.run(main())
